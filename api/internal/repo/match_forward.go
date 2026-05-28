package repo

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/matching"
)

type UserForMatch struct {
	UserID          uuid.UUID
	ProfileJSON     []byte
	PreferencesJSON []byte
}

type JobForMatch struct {
	ID            uuid.UUID
	Title         string
	Company       string
	Location      *string
	Description   *string
	FormLabels    []string
	Embedding     []float32
	JobFactsJSON  []byte
}

// GetJobForMatch loads job data needed for forward matching.
func GetJobForMatch(ctx context.Context, pool *pgxpool.Pool, jobID uuid.UUID) (*JobForMatch, error) {
	var j JobForMatch
	var embText *string
	err := pool.QueryRow(ctx, `
		SELECT title, company, location, description, embedding::text, job_facts_json
		FROM discovered_jobs WHERE id = $1`, jobID).Scan(
		&j.Title, &j.Company, &j.Location, &j.Description, &embText, &j.JobFactsJSON)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	j.ID = jobID
	if embText != nil && *embText != "" {
		vec, err := parseVector(*embText)
		if err == nil {
			j.Embedding = vec
		}
	}

	rows, err := pool.Query(ctx, `SELECT label FROM job_form_fields WHERE job_id = $1 ORDER BY position`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var label string
		if err := rows.Scan(&label); err != nil {
			return nil, err
		}
		j.FormLabels = append(j.FormLabels, label)
	}
	return &j, rows.Err()
}

// ListUsersForMatching returns users with profile embedding chunks.
func ListUsersForMatching(ctx context.Context, pool *pgxpool.Pool) ([]UserForMatch, error) {
	rows, err := pool.Query(ctx, `
		SELECT up.user_id, up.profile::text, COALESCE(up.preferences_json::text, 'null')
		FROM user_profiles up
		WHERE EXISTS (SELECT 1 FROM profile_embedding_chunks pec WHERE pec.user_id = up.user_id)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []UserForMatch
	for rows.Next() {
		var u UserForMatch
		if err := rows.Scan(&u.UserID, &u.ProfileJSON, &u.PreferencesJSON); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// MatchJobToUsers runs forward match (job → users) and returns new match IDs.
func MatchJobToUsers(ctx context.Context, pool *pgxpool.Pool, jobID uuid.UUID, adjudicate matching.AdjudicateConfig) ([]int64, error) {
	job, err := GetJobForMatch(ctx, pool, jobID)
	if err != nil || job == nil {
		return nil, err
	}

	facts := jobFactsFromRow(*job)
	jobSections, err := GetJobSectionEmbeddings(ctx, pool, jobID)
	if err != nil {
		return nil, err
	}
	if len(jobSections) == 0 && len(job.Embedding) > 0 {
		jobSections = []SectionEmbedding{{
			SectionKey: matching.JobSectionPostingCore,
			Embedding:  job.Embedding,
		}}
	}
	if len(jobSections) == 0 {
		slog.Info("match_job_no_embeddings", "job_id", jobID)
		return nil, nil
	}

	users, err := ListUsersForMatching(ctx, pool)
	if err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return nil, nil
	}

	var matchIDs []int64
	for _, user := range users {
		prefs, err := loadUserPrefs(user)
		if err != nil {
			return nil, err
		}

		gate := matching.MatchEligible(prefs, facts)
		if !gate.OK {
			continue
		}

		score, err := ScoreUserJobForUser(ctx, pool, user.UserID, jobID, prefs.ProfileMode)
		if err != nil {
			return nil, err
		}
		if score.FinalScore < matching.FinalScoreFloor || score.MatchedChunks < matching.MinMatchedChunks {
			continue
		}

		loc, desc := "", ""
		if job.Location != nil {
			loc = *job.Location
		}
		if job.Description != nil {
			desc = *job.Description
		}

		adjudCtx, cancel := context.WithTimeout(ctx, 90*time.Second)
		adjudication, adjudErr := matching.AdjudicateMatch(adjudCtx, adjudicate, prefs, facts, matching.JobMatchContext{
			Title:       job.Title,
			Company:     job.Company,
			Location:    loc,
			Description: desc,
		}, score)
		cancel()
		if adjudErr != nil {
			slog.Warn("forward match adjudication fallback", "user_id", user.UserID, "error", adjudErr)
		}
		if !matching.AdjudicationAccepted(adjudication) {
			continue
		}
		if !matching.MatchPassesStretchFilter(prefs, &adjudication) {
			continue
		}

		matchScore := float32(score.FinalScore)
		if !matching.MatchPassesTierFilter(prefs, &matchScore, &score, &adjudication) {
			continue
		}

		matchReason := map[string]any{
			"gate":      gate,
			"direction": "forward",
			"strengths": adjudication.Strengths,
			"gaps":      adjudication.Gaps,
		}
		bdRaw, _ := json.Marshal(score)
		mrRaw, _ := json.Marshal(matchReason)
		adjRaw, _ := json.Marshal(adjudication)

		var matchID int64
		err = pool.QueryRow(ctx, `
			INSERT INTO job_matches (user_id, job_id, score, matched_chunks, status, gate_passed, score_breakdown, match_reason, adjudication)
			VALUES ($1, $2, $3, $4, 'pending', true, $5::jsonb, $6::jsonb, $7::jsonb)
			ON CONFLICT (user_id, job_id) DO NOTHING
			RETURNING id`,
			user.UserID, jobID, float32(score.FinalScore), score.MatchedChunks, bdRaw, mrRaw, adjRaw).Scan(&matchID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue
			}
			return nil, err
		}
		matchIDs = append(matchIDs, matchID)
	}
	return matchIDs, nil
}

func loadUserPrefs(u UserForMatch) (matching.UserPreferences, error) {
	if len(u.PreferencesJSON) > 0 && string(u.PreferencesJSON) != "null" {
		var prefs matching.UserPreferences
		if err := json.Unmarshal(u.PreferencesJSON, &prefs); err == nil {
			return prefs, nil
		}
	}
	return matching.BuildUserPreferences(u.ProfileJSON), nil
}

func jobFactsFromRow(job JobForMatch) matching.JobFacts {
	if len(job.JobFactsJSON) > 0 {
		f, err := matching.JobFactsFromJSON(job.JobFactsJSON)
		if err == nil && f.Title != "" {
			return f
		}
	}
	loc, desc := "", ""
	if job.Location != nil {
		loc = *job.Location
	}
	if job.Description != nil {
		desc = *job.Description
	}
	return matching.ExtractJobFacts(job.Title, job.Company, loc, desc, job.FormLabels)
}
