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

type UserJobMatch struct {
	JobID         uuid.UUID
	MatchID       int64
	MatchedChunks int
	AvgScore      float64
}

// ReverseMatchConfig configures the full reverse matching pipeline (Layers 1–3).
type ReverseMatchConfig struct {
	Lookback   time.Duration
	Adjudicate matching.AdjudicateConfig
}

// MatchUserToRecentJobs runs Layer 1 gate → Layer 2 scoring → Layer 3 LLM adjudication.
func MatchUserToRecentJobs(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, cfg ReverseMatchConfig) ([]UserJobMatch, error) {
	lookback := cfg.Lookback
	if lookback <= 0 {
		lookback = 14 * 24 * time.Hour
	}
	since := time.Now().Add(-lookback)

	prefs, err := LoadUserPreferences(ctx, pool, userID)
	if err != nil {
		return nil, err
	}

	userChunks, err := GetUserSectionChunks(ctx, pool, userID)
	if err != nil {
		return nil, err
	}
	if len(userChunks) == 0 {
		return nil, nil
	}

	jobs, err := ListRecentJobsForUserMatch(ctx, pool, since)
	if err != nil {
		return nil, err
	}
	if len(jobs) == 0 {
		return nil, nil
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var results []UserJobMatch
	for _, job := range jobs {
		facts := JobRowToFacts(job)

		gate := matching.MatchEligible(prefs, facts)
		if !gate.OK {
			continue
		}

		score, err := ScoreUserJobForUser(ctx, pool, userID, job.ID, prefs.ProfileMode)
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
		adjudication, adjudErr := matching.AdjudicateMatch(adjudCtx, cfg.Adjudicate, prefs, facts, matching.JobMatchContext{
			Title:       job.Title,
			Company:     job.Company,
			Location:    loc,
			Description: desc,
		}, score)
		cancel()
		if adjudErr != nil {
			slog.Warn("reverse match adjudication fallback", "job_id", job.ID, "error", adjudErr)
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
			"direction": "reverse",
			"strengths": adjudication.Strengths,
			"gaps":      adjudication.Gaps,
		}
		bdRaw, _ := json.Marshal(score)
		mrRaw, _ := json.Marshal(matchReason)
		adjRaw, _ := json.Marshal(adjudication)

		var matchID int64
		err = tx.QueryRow(ctx, `
			INSERT INTO job_matches (user_id, job_id, score, matched_chunks, status, gate_passed, score_breakdown, match_reason, adjudication)
			VALUES ($1, $2, $3, $4, 'pending', true, $5::jsonb, $6::jsonb, $7::jsonb)
			ON CONFLICT (user_id, job_id) DO NOTHING
			RETURNING id`, userID, job.ID, float32(score.FinalScore), score.MatchedChunks, bdRaw, mrRaw, adjRaw).Scan(&matchID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				continue
			}
			return nil, err
		}

		results = append(results, UserJobMatch{
			JobID:         job.ID,
			MatchID:       matchID,
			MatchedChunks: score.MatchedChunks,
			AvgScore:      score.FinalScore,
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return results, nil
}

// LoadUserPreferences reads preferences_json or builds from profile JSON.
func LoadUserPreferences(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (matching.UserPreferences, error) {
	var prefsRaw, profileRaw []byte
	err := pool.QueryRow(ctx, `
		SELECT COALESCE(preferences_json::text, 'null'), profile::text
		FROM user_profiles WHERE user_id = $1`, userID).Scan(&prefsRaw, &profileRaw)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return matching.UserPreferences{}, nil
		}
		return matching.UserPreferences{}, err
	}
	if string(prefsRaw) != "null" && len(prefsRaw) > 2 {
		var prefs matching.UserPreferences
		if err := json.Unmarshal(prefsRaw, &prefs); err == nil {
			return prefs, nil
		}
	}
	return matching.BuildUserPreferences(profileRaw), nil
}
