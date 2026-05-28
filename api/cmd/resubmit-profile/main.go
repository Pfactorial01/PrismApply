// Resubmit-profile upserts a profile JSON, re-embeds, reverse-matches, and enqueues tailor jobs.
// Usage: go run ./cmd/resubmit-profile <email> <profile.json>
package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/embeddings"
	"prismapply/api/internal/jobs"
	"prismapply/api/internal/matching"
	"prismapply/api/internal/profilemode"
	"prismapply/api/internal/redisx"
	"prismapply/api/internal/repo"
)

const embedBatchSize = 32

func main() {
	if len(os.Args) < 3 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/resubmit-profile <email> <profile.json>")
		os.Exit(1)
	}
	email := os.Args[1]
	profilePath := os.Args[2]

	profileRaw, err := os.ReadFile(profilePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read profile: %v\n", err)
		os.Exit(1)
	}
	if !json.Valid(profileRaw) {
		fmt.Fprintln(os.Stderr, "invalid profile json")
		os.Exit(1)
	}
	normalized, err := profilemode.NormalizeProfileJSON(profileRaw)
	if err != nil {
		fmt.Fprintf(os.Stderr, "normalize profile: %v\n", err)
		os.Exit(1)
	}
	profileRaw = normalized

	cfg := config.FromEnv()
	if cfg.DatabaseURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL required")
		os.Exit(1)
	}
	if strings.TrimSpace(cfg.OpenAIAPIKey) == "" {
		fmt.Fprintln(os.Stderr, "OPENAI_API_KEY required")
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	u, _, err := repo.UserByEmail(ctx, pool, email)
	if err != nil {
		fmt.Fprintf(os.Stderr, "user lookup: %v\n", err)
		os.Exit(1)
	}

	if err := repo.UpsertProfile(ctx, pool, u.ID, profileRaw); err != nil {
		fmt.Fprintf(os.Stderr, "upsert profile: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("profile saved for %s (%s)\n", email, u.ID)

	if err := submitProfile(ctx, cfg, pool, u.ID, profileRaw); err != nil {
		fmt.Fprintf(os.Stderr, "submit: %v\n", err)
		os.Exit(1)
	}
}

func submitProfile(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, userID uuid.UUID, profileRaw []byte) error {
	prefs := matching.BuildUserPreferences(profileRaw)
	if err := repo.UpdateProfilePreferences(ctx, pool, userID, prefs); err != nil {
		return fmt.Errorf("update preferences: %w", err)
	}
	fmt.Println("preferences saved")

	if n, err := repo.DeletePendingJobMatches(ctx, pool, userID); err != nil {
		return fmt.Errorf("clear pending matches: %w", err)
	} else if n > 0 {
		fmt.Printf("cleared %d stale pending matches\n", n)
	}

	if err := embedProfile(ctx, cfg, pool, userID, profileRaw); err != nil {
		return fmt.Errorf("embed: %w", err)
	}

	rdb, err := redisx.New(cfg)
	if err != nil {
		return fmt.Errorf("redis: %w", err)
	}
	defer func() { _ = rdb.Close() }()

	matches, err := repo.MatchUserToRecentJobs(ctx, pool, userID, repo.ReverseMatchConfig{
		Lookback: 30 * 24 * time.Hour,
		Adjudicate: matching.AdjudicateConfig{
			Enabled: cfg.MatchAdjudicationEnabled,
			APIKey:  cfg.OpenAIAPIKey,
			BaseURL: cfg.OpenAIBaseURL,
			Model:   cfg.MatchAdjudicationModel,
		},
	})
	if err != nil {
		return fmt.Errorf("match: %w", err)
	}
	fmt.Printf("matches created/found: %d\n", len(matches))
	for _, m := range matches {
		var title, company string
		_ = pool.QueryRow(ctx, `SELECT title, company FROM discovered_jobs WHERE id = $1`, m.JobID).Scan(&title, &company)
		fmt.Printf("  match_id=%d score=%.3f %s @ %s\n", m.MatchID, m.AvgScore, title, company)
		if err := jobs.EnqueueMatch(ctx, rdb, m.MatchID); err != nil {
			fmt.Fprintf(os.Stderr, "redis push match_id=%d: %v\n", m.MatchID, err)
		}
	}
	return nil
}

func embedProfile(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, userID uuid.UUID, raw []byte) error {
	input := embeddings.ProfileJSONToEmbedInput(raw)
	if input == "" {
		return errors.New("empty profile text for embedding")
	}

	embCtx, cancel := context.WithTimeout(ctx, 4*time.Minute)
	defer cancel()

	vec, err := embeddings.CreateEmbedding(embCtx, cfg.OpenAIAPIKey, cfg.OpenAIBaseURL, cfg.EmbeddingModel, input)
	if err != nil {
		return err
	}
	if err := repo.UpdateProfileSummaryEmbedding(ctx, pool, userID, vec); err != nil {
		return err
	}

	sections := matching.BuildProfileSections(raw)
	if len(sections) == 0 {
		return errors.New("no profile sections to embed")
	}

	texts := make([]string, len(sections))
	for i, s := range sections {
		texts[i] = s.Content
	}

	var rows []repo.ProfileEmbeddingChunkV2
	for i := 0; i < len(texts); i += embedBatchSize {
		end := min(i+embedBatchSize, len(texts))
		batch := texts[i:end]
		vecs, err := embeddings.CreateEmbeddingsBatch(embCtx, cfg.OpenAIAPIKey, cfg.OpenAIBaseURL, cfg.EmbeddingModel, batch)
		if err != nil {
			return err
		}
		if len(vecs) != len(batch) {
			return errors.New("embedding batch size mismatch")
		}
		for j := range batch {
			sec := sections[i+j]
			rows = append(rows, repo.ProfileEmbeddingChunkV2{
				ChunkIndex: i + j,
				SectionKey: sec.Key,
				Content:    sec.Content,
				Embedding:  vecs[j],
			})
		}
	}

	if err := repo.ReplaceProfileEmbeddingChunksV2(ctx, pool, userID, rows); err != nil {
		return err
	}
	fmt.Printf("embedded %d sections\n", len(rows))
	return nil
}
