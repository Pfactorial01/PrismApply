package repo

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/matching"
)

// ProfileEmbeddingChunkV2 includes section metadata for layered matching.
type ProfileEmbeddingChunkV2 struct {
	ChunkIndex int
	SectionKey string
	Content    string
	Embedding  []float32
}

// ReplaceProfileEmbeddingChunksV2 replaces chunks with section keys.
func ReplaceProfileEmbeddingChunksV2(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, chunks []ProfileEmbeddingChunkV2) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM profile_embedding_chunks WHERE user_id = $1`, userID); err != nil {
		return err
	}
	for _, c := range chunks {
		if c.Content == "" {
			continue
		}
		lit := FormatVector(c.Embedding)
		hash := contentSHA256(c.Content)
		section := c.SectionKey
		if section == "" {
			section = "legacy"
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO profile_embedding_chunks (user_id, chunk_index, section_key, content, content_sha256, embedding)
			VALUES ($1, $2, $3, $4, $5, $6::vector)`,
			userID, c.ChunkIndex, section, c.Content, hash, lit); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// UpdateProfilePreferences stores normalized preferences JSON on submit.
func UpdateProfilePreferences(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, prefs matching.UserPreferences) error {
	raw, err := matching.PreferencesToJSON(prefs)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO user_profiles (user_id, profile, preferences_json, updated_at)
		VALUES ($1, '{}'::jsonb, $2::jsonb, now())
		ON CONFLICT (user_id) DO UPDATE
		SET preferences_json = EXCLUDED.preferences_json, updated_at = now()`, userID, raw)
	return err
}

// DeletePendingJobMatches removes stale pending matches before re-matching.
func DeletePendingJobMatches(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (int64, error) {
	tag, err := pool.Exec(ctx, `
		DELETE FROM job_matches jm
		WHERE jm.user_id = $1
		  AND jm.status = 'pending'
		  AND NOT EXISTS (
		    SELECT 1 FROM tailored_applications ta WHERE ta.match_id = jm.id
		  )`, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

type JobRowForMatch struct {
	ID            uuid.UUID
	Title         string
	Company       string
	Location      *string
	Description   *string
	JobFactsJSON  []byte
	RemotePolicy  *string
	EmploymentType *string
	SeniorityLevel *string
	RequiresSponsorship *bool
	IndustryTags  []string
	HasHeavyOncall *bool
}

// ListRecentJobsForUserMatch returns jobs discovered within lookback for reverse matching.
func ListRecentJobsForUserMatch(ctx context.Context, pool *pgxpool.Pool, since interface{}) ([]JobRowForMatch, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, title, company, location, description, job_facts_json,
		       remote_policy, employment_type, seniority_level, requires_sponsorship,
		       industry_tags, has_heavy_oncall
		FROM discovered_jobs
		WHERE discovered_at >= $1 AND embedding IS NOT NULL
		ORDER BY discovered_at DESC`, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []JobRowForMatch
	for rows.Next() {
		var r JobRowForMatch
		if err := rows.Scan(&r.ID, &r.Title, &r.Company, &r.Location, &r.Description, &r.JobFactsJSON,
			&r.RemotePolicy, &r.EmploymentType, &r.SeniorityLevel, &r.RequiresSponsorship,
			&r.IndustryTags, &r.HasHeavyOncall); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func JobRowToFacts(r JobRowForMatch) matching.JobFacts {
	if len(r.JobFactsJSON) > 0 {
		f, err := matching.JobFactsFromJSON(r.JobFactsJSON)
		if err == nil && f.Title != "" {
			return f
		}
	}
	loc, desc := "", ""
	if r.Location != nil {
		loc = *r.Location
	}
	if r.Description != nil {
		desc = *r.Description
	}
	f := matching.ExtractJobFacts(r.Title, r.Company, loc, desc, nil)
	if r.RemotePolicy != nil && *r.RemotePolicy != "" {
		f.RemotePolicy = *r.RemotePolicy
	}
	if r.EmploymentType != nil {
		f.EmploymentType = *r.EmploymentType
	}
	if r.SeniorityLevel != nil {
		f.SeniorityLevel = *r.SeniorityLevel
	}
	if r.RequiresSponsorship != nil {
		f.RequiresSponsorship = r.RequiresSponsorship
	}
	if len(r.IndustryTags) > 0 {
		f.IndustryTags = r.IndustryTags
	}
	if r.HasHeavyOncall != nil {
		f.HasHeavyOncall = *r.HasHeavyOncall
	}
	return f
}

type SectionEmbedding struct {
	SectionKey string
	Embedding  []float32
}

// GetJobSectionEmbeddings loads per-section job vectors.
func GetJobSectionEmbeddings(ctx context.Context, pool *pgxpool.Pool, jobID uuid.UUID) ([]SectionEmbedding, error) {
	rows, err := pool.Query(ctx, `
		SELECT section_key, embedding::text FROM job_embedding_sections WHERE job_id = $1`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SectionEmbedding
	for rows.Next() {
		var key, raw string
		if err := rows.Scan(&key, &raw); err != nil {
			return nil, err
		}
		vec, err := parseVector(raw)
		if err != nil {
			continue
		}
		out = append(out, SectionEmbedding{SectionKey: key, Embedding: vec})
	}
	return out, rows.Err()
}

type UserSectionChunk struct {
	SectionKey string
	Embedding  []float32
}

// GetUserSectionChunks returns embedded profile sections for a user.
func GetUserSectionChunks(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) ([]UserSectionChunk, error) {
	rows, err := pool.Query(ctx, `
		SELECT section_key, embedding::text FROM profile_embedding_chunks WHERE user_id = $1`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []UserSectionChunk
	for rows.Next() {
		var key, raw string
		if err := rows.Scan(&key, &raw); err != nil {
			return nil, err
		}
		vec, err := parseVector(raw)
		if err != nil {
			continue
		}
		out = append(out, UserSectionChunk{SectionKey: key, Embedding: vec})
	}
	return out, rows.Err()
}

// ScoreUserJob computes Layer 2 semantic score between user sections and job sections.
func ScoreUserJob(ctx context.Context, pool *pgxpool.Pool, userID, jobID uuid.UUID) (matching.ScoreBreakdown, error) {
	userChunks, err := GetUserSectionChunks(ctx, pool, userID)
	if err != nil {
		return matching.ScoreBreakdown{}, err
	}
	if len(userChunks) == 0 {
		return matching.ScoreBreakdown{}, nil
	}

	jobSections, err := GetJobSectionEmbeddings(ctx, pool, jobID)
	if err != nil {
		return matching.ScoreBreakdown{}, err
	}
	if len(jobSections) == 0 {
		emb, err := GetJobEmbedding(ctx, pool, jobID)
		if err != nil || len(emb) == 0 {
			return matching.ScoreBreakdown{}, nil
		}
		jobSections = []SectionEmbedding{{
			SectionKey: matching.JobSectionPostingCore,
			Embedding:  emb,
		}}
	}

	return scoreBreakdownFromSections(userChunks, jobSections, ""), nil
}

// ScoreUserJobForUser computes Layer 2 score with mode-aware weighting from user preferences.
func ScoreUserJobForUser(ctx context.Context, pool *pgxpool.Pool, userID, jobID uuid.UUID, profileMode string) (matching.ScoreBreakdown, error) {
	userChunks, err := GetUserSectionChunks(ctx, pool, userID)
	if err != nil {
		return matching.ScoreBreakdown{}, err
	}
	if len(userChunks) == 0 {
		return matching.ScoreBreakdown{}, nil
	}

	jobSections, err := GetJobSectionEmbeddings(ctx, pool, jobID)
	if err != nil {
		return matching.ScoreBreakdown{}, err
	}
	if len(jobSections) == 0 {
		emb, err := GetJobEmbedding(ctx, pool, jobID)
		if err != nil || len(emb) == 0 {
			return matching.ScoreBreakdown{}, nil
		}
		jobSections = []SectionEmbedding{{
			SectionKey: matching.JobSectionPostingCore,
			Embedding:  emb,
		}}
	}

	return scoreBreakdownFromSections(userChunks, jobSections, profileMode), nil
}

func scoreBreakdownFromSections(userChunks []UserSectionChunk, jobSections []SectionEmbedding, profileMode string) matching.ScoreBreakdown {
	jobByKey := map[string][]float32{}
	for _, j := range jobSections {
		jobByKey[j.SectionKey] = j.Embedding
	}

	posting := jobByKey[matching.JobSectionPostingCore]
	reqs := jobByKey[matching.JobSectionRequirements]
	if len(reqs) == 0 {
		reqs = posting
	}

	var resumeSims, skillsSims, targetsSims, expSims, allSims []float64
	matchedAbove := 0

	for _, uc := range userChunks {
		if uc.SectionKey == matching.SectionConstraints {
			continue
		}
		for _, jv := range jobSections {
			s := cosineSim(uc.Embedding, jv.Embedding)
			if s > matching.ChunkSimilarityThreshold {
				matchedAbove++
			}
			allSims = append(allSims, s)
		}
		switch {
		case matching.SectionPrefixMatch(uc.SectionKey, matching.SectionResume):
			if len(posting) > 0 {
				resumeSims = append(resumeSims, cosineSim(uc.Embedding, posting))
			}
		case uc.SectionKey == matching.SectionSkills:
			if len(reqs) > 0 {
				skillsSims = append(skillsSims, cosineSim(uc.Embedding, reqs))
			}
		case uc.SectionKey == matching.SectionTargets:
			if len(posting) > 0 {
				targetsSims = append(targetsSims, cosineSim(uc.Embedding, posting))
			}
		case uc.SectionKey == matching.SectionExperience || matching.SectionPrefixMatch(uc.SectionKey, matching.SectionProjects) ||
			uc.SectionKey == matching.SectionEducation || uc.SectionKey == matching.SectionInternships ||
			matching.SectionPrefixMatch(uc.SectionKey, matching.SectionInternships):
			if len(posting) > 0 {
				expSims = append(expSims, cosineSim(uc.Embedding, posting))
			}
		}
	}

	b := matching.ScoreBreakdown{
		ResumePosting:  avg(resumeSims),
		SkillsReqs:     avg(skillsSims),
		TargetsPosting: avg(targetsSims),
		ExperienceDesc: avg(expSims),
		MaxChunkSim:    max(allSims),
		MatchedChunks:  matchedAbove,
	}
	matching.ComputeFinalScoreForMode(&b, profileMode)
	return b
}

func cosineSim(a, b []float32) float64 {
	if len(a) == 0 || len(b) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		dot += float64(a[i]) * float64(b[i])
		na += float64(a[i]) * float64(a[i])
		nb += float64(b[i]) * float64(b[i])
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return dot / (sqrt(na) * sqrt(nb))
}

func sqrt(x float64) float64 {
	if x <= 0 {
		return 0
	}
	z := x
	for i := 0; i < 10; i++ {
		z = (z + x/z) / 2
	}
	return z
}

func avg(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	var s float64
	for _, v := range vals {
		s += v
	}
	return s / float64(len(vals))
}

func max(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	m := vals[0]
	for _, v := range vals[1:] {
		if v > m {
			m = v
		}
	}
	return m
}

// InsertJobMatchV2 inserts a match with gate/score metadata.
func InsertJobMatchV2(ctx context.Context, pool *pgxpool.Pool, userID, jobID uuid.UUID, score float32, matchedChunks int, gatePassed bool, breakdown matching.ScoreBreakdown, matchReason map[string]any) (int64, error) {
	bdRaw, _ := json.Marshal(breakdown)
	mrRaw, _ := json.Marshal(matchReason)
	var id int64
	err := pool.QueryRow(ctx, `
		INSERT INTO job_matches (user_id, job_id, score, matched_chunks, status, gate_passed, score_breakdown, match_reason)
		VALUES ($1, $2, $3, $4, 'pending', $5, $6::jsonb, $7::jsonb)
		ON CONFLICT (user_id, job_id) DO NOTHING
		RETURNING id`, userID, jobID, score, matchedChunks, gatePassed, bdRaw, mrRaw).Scan(&id)
	return id, err
}
