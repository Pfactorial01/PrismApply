// Rebuild and re-embed job section vectors (posting_core, requirements, logistics, form_fields).
// Usage: go run ./cmd/reembed-job-sections
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/embeddings"
	"prismapply/api/internal/matching"
	"prismapply/api/internal/repo"
)

func main() {
	cfg := config.FromEnv()
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer pool.Close()

	rows, err := pool.Query(ctx, `
		SELECT id, title, company, COALESCE(location, ''), COALESCE(description, '')
		FROM discovered_jobs WHERE embedding IS NOT NULL`)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer rows.Close()

	var ok, fail int
	for rows.Next() {
		var id uuid.UUID
		var title, company, location, description string
		if err := rows.Scan(&id, &title, &company, &location, &description); err != nil {
			fail++
			continue
		}
		if err := reembedJob(ctx, cfg, pool, id, title, company, location, description); err != nil {
			fmt.Fprintf(os.Stderr, "job %s: %v\n", id, err)
			fail++
			continue
		}
		ok++
	}
	fmt.Printf("re-embedded %d jobs (%d failed)\n", ok, fail)
}

func reembedJob(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, jobID uuid.UUID, title, company, location, description string) error {
	labels, err := loadFormLabels(ctx, pool, jobID)
	if err != nil {
		return err
	}
	facts := matching.ExtractJobFacts(title, company, location, description, labels)
	sections := matching.BuildJobSections(title, company, location, description, labels, facts)
	if len(sections) == 0 {
		return fmt.Errorf("no sections")
	}

	texts := make([]string, len(sections))
	for i, s := range sections {
		texts[i] = s.Content
	}
	embCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	vecs, err := embeddings.CreateEmbeddingsBatch(embCtx, cfg.OpenAIAPIKey, cfg.OpenAIBaseURL, cfg.EmbeddingModel, texts)
	cancel()
	if err != nil {
		return err
	}

	var sectionRows []repo.JobSectionRow
	for i, s := range sections {
		sectionRows = append(sectionRows, repo.JobSectionRow{
			SectionKey: s.Key,
			Content:    s.Content,
			Embedding:  vecs[i],
		})
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM job_embedding_sections WHERE job_id = $1`, jobID); err != nil {
		return err
	}
	for _, s := range sectionRows {
		if _, err := tx.Exec(ctx, `
			INSERT INTO job_embedding_sections (job_id, section_key, content, embedding)
			VALUES ($1, $2, $3, $4::vector)`,
			jobID, s.SectionKey, s.Content, repo.FormatVector(s.Embedding)); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func loadFormLabels(ctx context.Context, pool *pgxpool.Pool, jobID uuid.UUID) ([]string, error) {
	rows, err := pool.Query(ctx, `
		SELECT label FROM job_form_fields WHERE job_id = $1 ORDER BY position`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var labels []string
	for rows.Next() {
		var label string
		if err := rows.Scan(&label); err != nil {
			return nil, err
		}
		labels = append(labels, label)
	}
	return labels, rows.Err()
}
