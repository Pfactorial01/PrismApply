package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/embeddings"
	"prismapply/api/internal/embedqueue"
	"prismapply/api/internal/jobs"
	"prismapply/api/internal/matching"
	"prismapply/api/internal/obslog"
	"prismapply/api/internal/redisx"
	"prismapply/api/internal/repo"
)

const (
	embedBatchSize = 32
)

func main() {
	obslog.Init("prismapply-embed-worker")

	cfg := config.FromEnv()
	if cfg.DatabaseURL == "" {
		slog.Error("missing DATABASE_URL")
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("database connect failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	rdb, err := redisx.New(cfg)
	if err != nil {
		slog.Error("redis client init failed", "error", err)
		os.Exit(1)
	}
	defer func() { _ = rdb.Close() }()
	if err := redisx.Ping(ctx, rdb); err != nil {
		if redisx.IsNOAUTH(err) {
			slog.Error("redis NOAUTH — set REDIS_PASSWORD or REDIS_URL in api/.env, or use make run-worker-dev-redis")
			os.Exit(1)
		}
		slog.Error("redis ping failed", "error", err)
		os.Exit(1)
	}

	qk := cfg.EmbeddingQueueKey
	if qk == "" {
		qk = embedqueue.DefaultQueueKey
	}
	dlq := cfg.EmbeddingDLQKey
	if dlq == "" {
		dlq = embedqueue.DefaultDLQKey
	}

	slog.Info("embed worker listening", "queue", qk, "dlq", dlq)

	sigCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	for {
		vals, err := rdb.BRPop(sigCtx, 5*time.Second, qk).Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				continue
			}
			if sigCtx.Err() != nil || errors.Is(err, context.Canceled) {
				slog.Info("shutdown", "error", err)
				return
			}
			slog.Warn("brpop failed", "error", err)
			time.Sleep(time.Second)
			continue
		}
		if len(vals) != 2 {
			continue
		}
		jobBytes := []byte(vals[1])
		if err := processJob(sigCtx, cfg, pool, rdb, jobBytes); err != nil {
			slog.Error("embed job failed", "error", err)
			_ = embedqueue.PushDLQ(sigCtx, rdb, dlq, jobBytes, err.Error())
		}
	}
}

func processJob(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, rdb *redis.Client, jobBytes []byte) error {
	var job embedqueue.ProfileJob
	if err := json.Unmarshal(jobBytes, &job); err != nil {
		return err
	}
	uid, err := uuid.Parse(strings.TrimSpace(job.UserID))
	if err != nil {
		return err
	}

	runID := uuid.New().String()
	lg := slog.With(
		"worker_run_id", runID,
		"request_id", job.RequestID,
		"user_id", uid.String(),
	)

	raw, err := repo.GetProfile(ctx, pool, uid)
	if err != nil {
		return err
	}
	if embedqueue.IsEmptyProfileJSON(raw) {
		lg.Info("skip embed: empty profile json")
		return nil
	}

	input := embeddings.ProfileJSONToEmbedInput(raw)
	if input == "" {
		return errors.New("profile text for embedding is empty")
	}

	if strings.TrimSpace(cfg.OpenAIAPIKey) == "" {
		return errors.New("OPENAI_API_KEY is not set (worker needs it to call the embeddings API)")
	}

	embCtx, cancel := context.WithTimeout(ctx, 4*time.Minute)
	defer cancel()

	vec, err := embeddings.CreateEmbedding(embCtx, cfg.OpenAIAPIKey, cfg.OpenAIBaseURL, cfg.EmbeddingModel, input)
	if err != nil {
		return err
	}
	if err := repo.UpdateProfileSummaryEmbedding(ctx, pool, uid, vec); err != nil {
		return err
	}
	lg.Info("profile summary embedding updated")

	sections := matching.BuildProfileSections(raw)
	if len(sections) == 0 {
		return nil
	}

	var texts []string
	for _, s := range sections {
		texts = append(texts, s.Content)
	}

	var rows []repo.ProfileEmbeddingChunkV2
	for i := 0; i < len(texts); i += embedBatchSize {
		end := min(i+embedBatchSize, len(texts))
		batch := texts[i:end]
		vecs, berr := embeddings.CreateEmbeddingsBatch(embCtx, cfg.OpenAIAPIKey, cfg.OpenAIBaseURL, cfg.EmbeddingModel, batch)
		if berr != nil {
			return berr
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

	if err := repo.ReplaceProfileEmbeddingChunksV2(ctx, pool, uid, rows); err != nil {
		return err
	}
	lg.Info("profile section embeddings replaced", "chunk_count", len(rows))

	// Reverse match: Layer 1 gate + Layer 2 scoring + Layer 3 adjudication
	matches, err := repo.MatchUserToRecentJobs(ctx, pool, uid, repo.ReverseMatchConfig{
		Lookback: 14 * 24 * time.Hour,
		Adjudicate: matching.AdjudicateConfig{
			Enabled: cfg.MatchAdjudicationEnabled,
			APIKey:  cfg.OpenAIAPIKey,
			BaseURL: cfg.OpenAIBaseURL,
			Model:   cfg.MatchAdjudicationModel,
		},
	})
	if err != nil {
		lg.Warn("reverse matching failed", "error", err)
		return nil
	}
	if len(matches) > 0 {
		lg.Info("reverse matching found jobs", "count", len(matches))
		for _, m := range matches {
			if err := jobs.EnqueueMatch(ctx, rdb, m.MatchID); err != nil {
				lg.Warn("failed to push match to queue", "match_id", m.MatchID, "error", err)
			}
		}
	}
	return nil
}
