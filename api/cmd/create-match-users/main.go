// Create three test users with profiles tuned to discovered jobs, embed, and reverse-match.
// Usage: go run ./cmd/create-match-users
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
	"prismapply/api/internal/matching"
	"prismapply/api/internal/repo"
	"prismapply/api/internal/seeddata"
)

const embedBatchSize = 32

var testUsers = []struct {
	email string
	raw   []byte
}{
	{"adeoyeadebayo18+6@gmail.com", seeddata.MatchUserJavaJSON},
	{"adeoyeadebayo18+7@gmail.com", seeddata.MatchUserEmbeddedJSON},
	{"adeoyeadebayo18+8@gmail.com", seeddata.MatchUserBackendJSON},
}

func main() {
	cfg := config.FromEnv()
	if cfg.DatabaseURL == "" {
		fmt.Fprintln(os.Stderr, "DATABASE_URL required")
		os.Exit(1)
	}
	if strings.TrimSpace(cfg.OpenAIAPIKey) == "" {
		fmt.Fprintln(os.Stderr, "OPENAI_API_KEY required for embeddings")
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	_, hash, err := repo.UserByEmail(ctx, pool, "adeoyeadebayo18+5@gmail.com")
	if err != nil {
		fmt.Fprintf(os.Stderr, "lookup reference user: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Discovered jobs in DB: ")
	printJobSummary(ctx, pool)

	for _, tu := range testUsers {
		if err := upsertTestUser(ctx, cfg, pool, tu.email, hash, tu.raw); err != nil {
			fmt.Fprintf(os.Stderr, "%s: %v\n", tu.email, err)
			os.Exit(1)
		}
	}
}

func printJobSummary(ctx context.Context, pool *pgxpool.Pool) {
	var n int
	_ = pool.QueryRow(ctx, `SELECT count(*) FROM discovered_jobs WHERE embedding IS NOT NULL`).Scan(&n)
	fmt.Printf("%d with embeddings\n", n)
}

func upsertTestUser(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, email, passwordHash string, profileRaw []byte) error {
	if !json.Valid(profileRaw) {
		return errors.New("invalid profile json")
	}

	var id uuid.UUID
	u, _, err := repo.UserByEmail(ctx, pool, email)
	switch {
	case err == nil:
		id = u.ID
		fmt.Printf("\n[%s] existing user %s\n", email, id)
	case errors.Is(err, repo.ErrNotFound):
		id, err = repo.CreateUser(ctx, pool, email, passwordHash)
		if err != nil {
			return err
		}
		fmt.Printf("\n[%s] created user %s\n", email, id)
	default:
		return err
	}

	if err := repo.UpsertProfile(ctx, pool, id, profileRaw); err != nil {
		return fmt.Errorf("upsert profile: %w", err)
	}
	fmt.Printf("  profile saved\n")

	if err := submitProfile(ctx, cfg, pool, id, profileRaw); err != nil {
		return err
	}
	return nil
}

func submitProfile(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, userID uuid.UUID, profileRaw []byte) error {
	prefs := matching.BuildUserPreferences(profileRaw)
	if err := repo.UpdateProfilePreferences(ctx, pool, userID, prefs); err != nil {
		return fmt.Errorf("update preferences: %w", err)
	}
	fmt.Printf("  preferences saved\n")

	if n, err := repo.DeletePendingJobMatches(ctx, pool, userID); err != nil {
		return fmt.Errorf("clear pending matches: %w", err)
	} else if n > 0 {
		fmt.Printf("  cleared %d stale pending matches\n", n)
	}

	if err := embedProfile(ctx, cfg, pool, userID, profileRaw); err != nil {
		return fmt.Errorf("embed: %w", err)
	}

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
	fmt.Printf("  profile submitted — matches created/found: %d\n", len(matches))
	for i, m := range matches {
		if i >= 5 {
			fmt.Printf("  ... and %d more\n", len(matches)-5)
			break
		}
		var title, company string
		_ = pool.QueryRow(ctx, `SELECT title, company FROM discovered_jobs WHERE id = $1`, m.JobID).Scan(&title, &company)
		fmt.Printf("    match_id=%d score=%.3f %s @ %s\n", m.MatchID, m.AvgScore, title, company)
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
	fmt.Printf("  embedded %d sections\n", len(rows))
	return nil
}
