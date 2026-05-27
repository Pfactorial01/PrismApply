// Backfill missing ATS form fields for stored discovered jobs.
// Usage:
//
//	go run ./cmd/backfill-form-fields          # all lever/ashby jobs missing fields
//	go run ./cmd/backfill-form-fields <url>    # single job by listing URL
package main

import (
	"context"
	"fmt"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/discovery"
	"prismapply/api/internal/repo"
)

func main() {
	cfg := config.FromEnv()
	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	if len(os.Args) > 1 {
		if err := backfillOne(ctx, pool, os.Args[1]); err != nil {
			panic(err)
		}
		return
	}

	rows, err := pool.Query(ctx, `
		SELECT dj.id, dj.source, dj.job_url
		FROM discovered_jobs dj
		WHERE dj.source IN ('lever', 'ashby')
		  AND NOT EXISTS (SELECT 1 FROM job_form_fields jff WHERE jff.job_id = dj.id)
		ORDER BY dj.source, dj.company`)
	if err != nil {
		panic(err)
	}
	defer rows.Close()

	var ok, fail int
	for rows.Next() {
		var id uuid.UUID
		var source, jobURL string
		if err := rows.Scan(&id, &source, &jobURL); err != nil {
			panic(err)
		}
		if err := backfillJob(ctx, pool, source, jobURL, id); err != nil {
			fmt.Fprintf(os.Stderr, "FAIL %s %s: %v\n", source, jobURL, err)
			fail++
			continue
		}
		ok++
	}
	if err := rows.Err(); err != nil {
		panic(err)
	}
	fmt.Printf("backfill complete: updated=%d failed=%d\n", ok, fail)
}

func backfillOne(ctx context.Context, pool *pgxpool.Pool, jobURL string) error {
	src, ok := discovery.DetectSource(jobURL)
	if !ok {
		return fmt.Errorf("unsupported ATS URL: %s", jobURL)
	}
	var id uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM discovered_jobs WHERE job_url=$1`, discovery.NormalizeListingURL(jobURL)).Scan(&id); err != nil {
		return err
	}
	return backfillJob(ctx, pool, src, discovery.NormalizeListingURL(jobURL), id)
}

func backfillJob(ctx context.Context, pool *pgxpool.Pool, source, jobURL string, jobID uuid.UUID) error {
	payload, err := discovery.FetchJobViaATSAPI(ctx, jobURL, source, nil)
	if err != nil {
		return err
	}
	if len(payload.FormFields) == 0 {
		return fmt.Errorf("no form fields parsed")
	}
	if err := repo.ReplaceJobFormFields(ctx, pool, jobID, payload.FormFields); err != nil {
		return err
	}
	fmt.Printf("updated %s %s (%d fields)\n", source, jobURL, len(payload.FormFields))
	return nil
}
