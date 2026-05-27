package repo

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/matching"
)

type FormFieldRow struct {
	Label     string   `json:"label"`
	FieldType string   `json:"field_type"`
	Required  bool     `json:"required"`
	Options   []string `json:"options"`
	Position  int      `json:"position"`
}

type DiscoveryQuery struct {
	ID       int64
	Query    string
	Priority int
}

type URLSource struct {
	URL    string
	Source string
}

type DedupResult struct {
	NewURLs    []URLSource
	KnownCount int
}

func LoadActiveDiscoveryQueries(ctx context.Context, pool *pgxpool.Pool) ([]DiscoveryQuery, error) {
	rows, err := pool.Query(ctx, `
		SELECT id, query, priority FROM discovery_search_queries
		WHERE active = true ORDER BY priority ASC, id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []DiscoveryQuery
	for rows.Next() {
		var q DiscoveryQuery
		if err := rows.Scan(&q.ID, &q.Query, &q.Priority); err != nil {
			return nil, err
		}
		out = append(out, q)
	}
	return out, rows.Err()
}

func RecordDiscoveryQueryRun(ctx context.Context, pool *pgxpool.Pool, queryID int64, resultCount int) error {
	_, err := pool.Exec(ctx, `
		UPDATE discovery_search_queries SET last_run_at = now(), last_result_count = $2 WHERE id = $1`,
		queryID, resultCount)
	return err
}

func DedupJobURLs(ctx context.Context, pool *pgxpool.Pool, items []URLSource) (DedupResult, error) {
	var out DedupResult
	for _, item := range items {
		id, found, err := LookupDiscoveredJobID(ctx, pool, item.Source, item.URL)
		if err != nil {
			return out, err
		}
		if found {
			_ = TouchDiscoveredJobLastSeen(ctx, pool, id)
			out.KnownCount++
			continue
		}
		out.NewURLs = append(out.NewURLs, item)
	}
	return out, nil
}

// LookupDiscoveredJobID finds a job by canonical listing URL (also matches legacy Ashby /application rows).
func LookupDiscoveredJobID(ctx context.Context, pool *pgxpool.Pool, source, canonicalURL string) (uuid.UUID, bool, error) {
	var id uuid.UUID
	err := pool.QueryRow(ctx, `
		SELECT id FROM discovered_jobs
		WHERE source = $1 AND (job_url = $2 OR job_url = $2 || '/application')
		LIMIT 1`, source, canonicalURL).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, nil
	}
	if err != nil {
		return uuid.Nil, false, err
	}
	return id, true, nil
}

func TouchDiscoveredJobLastSeen(ctx context.Context, pool *pgxpool.Pool, jobID uuid.UUID) error {
	_, err := pool.Exec(ctx, `UPDATE discovered_jobs SET last_seen_at = now() WHERE id = $1`, jobID)
	return err
}

type DiscoveredJobInsert struct {
	Source         string
	JobURL         string
	ApplyURL       string
	Title          string
	Company        string
	Location       string
	Description    string
	FormFields     []FormFieldRow
	SearchQueryID  *int64
	Embedding      []float32
	Facts          matching.JobFacts
	SectionRows    []JobSectionRow
}

type JobSectionRow struct {
	SectionKey string
	Content    string
	Embedding  []float32
}

func InsertDiscoveredJob(ctx context.Context, pool *pgxpool.Pool, job DiscoveredJobInsert) (uuid.UUID, bool, error) {
	rawData, _ := json.Marshal(map[string]any{
		"formFields": job.FormFields,
		"jobFacts":   job.Facts,
	})
	factsRaw, _ := json.Marshal(job.Facts)

	tx, err := pool.Begin(ctx)
	if err != nil {
		return uuid.Nil, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var lit *string
	if len(job.Embedding) > 0 {
		s := FormatVector(job.Embedding)
		lit = &s
	}

	var jobID uuid.UUID
	err = tx.QueryRow(ctx, `
		INSERT INTO discovered_jobs (
			source, job_url, apply_url, title, company, location, description,
			raw_data, embedding, search_query_id, last_seen_at,
			remote_policy, employment_type, seniority_level, requires_sponsorship,
			has_heavy_oncall, job_facts_json
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(),
		          $11, $12, $13, $14, $15, $16)
		ON CONFLICT (source, job_url) DO NOTHING
		RETURNING id`,
		job.Source, job.JobURL, job.ApplyURL, job.Title, job.Company, nullIfEmpty(job.Location),
		nullIfEmpty(job.Description), rawData, lit, job.SearchQueryID,
		job.Facts.RemotePolicy, job.Facts.EmploymentType, job.Facts.SeniorityLevel,
		job.Facts.RequiresSponsorship, job.Facts.HasHeavyOncall, factsRaw,
	).Scan(&jobID)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `
			SELECT id FROM discovered_jobs
			WHERE source = $1 AND (job_url = $2 OR job_url = $2 || '/application')
			LIMIT 1`, job.Source, job.JobURL,
		).Scan(&jobID)
		if err != nil {
			return uuid.Nil, false, err
		}
		if _, err := tx.Exec(ctx, `UPDATE discovered_jobs SET last_seen_at = now() WHERE id = $1`, jobID); err != nil {
			return uuid.Nil, false, err
		}
		if err := tx.Commit(ctx); err != nil {
			return uuid.Nil, false, err
		}
		return jobID, false, nil
	}
	if err != nil {
		return uuid.Nil, false, err
	}

	for i, f := range DedupeFormFieldsByLabel(job.FormFields) {
		var opts []byte
		if len(f.Options) > 0 {
			opts, _ = json.Marshal(f.Options)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO job_form_fields (job_id, label, field_type, required, options, position)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			jobID, f.Label, f.FieldType, f.Required, opts, i); err != nil {
			return uuid.Nil, false, err
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM job_embedding_sections WHERE job_id = $1`, jobID); err != nil {
		return uuid.Nil, false, err
	}
	for _, s := range job.SectionRows {
		if _, err := tx.Exec(ctx, `
			INSERT INTO job_embedding_sections (job_id, section_key, content, embedding)
			VALUES ($1, $2, $3, $4::vector)`,
			jobID, s.SectionKey, s.Content, FormatVector(s.Embedding)); err != nil {
			return uuid.Nil, false, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, false, err
	}
	return jobID, true, nil
}

// ReplaceJobFormFields replaces stored form fields for an existing discovered job.
func ReplaceJobFormFields(ctx context.Context, pool *pgxpool.Pool, jobID uuid.UUID, fields []FormFieldRow) error {
	fields = DedupeFormFieldsByLabel(fields)
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM job_form_fields WHERE job_id = $1`, jobID); err != nil {
		return err
	}
	for i, f := range fields {
		var opts []byte
		if len(f.Options) > 0 {
			opts, _ = json.Marshal(f.Options)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO job_form_fields (job_id, label, field_type, required, options, position)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			jobID, f.Label, f.FieldType, f.Required, opts, i); err != nil {
			return err
		}
	}

	rawFields, _ := json.Marshal(fields)
	if _, err := tx.Exec(ctx, `
		UPDATE discovered_jobs
		SET raw_data = COALESCE(raw_data, '{}'::jsonb) || jsonb_build_object('formFields', $2::jsonb)
		WHERE id = $1`, jobID, rawFields); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func nullIfEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
