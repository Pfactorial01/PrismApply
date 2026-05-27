// Rematch-user re-runs reverse matching for one user and enqueues tailor workflows.
// Usage: go run ./cmd/rematch-user <email>
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/google/uuid"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/jobs"
	"prismapply/api/internal/matching"
	"prismapply/api/internal/redisx"
	"prismapply/api/internal/repo"
)

func main() {
	email := "adeoyeadebayo18+5@gmail.com"
	if len(os.Args) > 1 {
		email = os.Args[1]
	}

	cfg := config.FromEnv()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	var userID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM users WHERE email = $1`, email).Scan(&userID); err != nil {
		fmt.Fprintf(os.Stderr, "user lookup: %v\n", err)
		os.Exit(1)
	}

	rdb, err := redisx.New(cfg)
	if err != nil {
		fmt.Fprintf(os.Stderr, "redis: %v\n", err)
		os.Exit(1)
	}
	defer func() { _ = rdb.Close() }()

	matches, err := repo.MatchUserToRecentJobs(ctx, pool, userID, repo.ReverseMatchConfig{
		Lookback: 14 * 24 * time.Hour,
		Adjudicate: matching.AdjudicateConfig{
			Enabled: cfg.MatchAdjudicationEnabled,
			APIKey:  cfg.OpenAIAPIKey,
			BaseURL: cfg.OpenAIBaseURL,
			Model:   cfg.MatchAdjudicationModel,
		},
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "match: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("user=%s matches=%d\n", email, len(matches))
	for _, m := range matches {
		fmt.Printf("  match_id=%d job_id=%s score=%.3f\n", m.MatchID, m.JobID, m.AvgScore)
		if err := jobs.EnqueueMatch(ctx, rdb, m.MatchID); err != nil {
			fmt.Fprintf(os.Stderr, "redis push match_id=%d: %v\n", m.MatchID, err)
		}
	}
}
