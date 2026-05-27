package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/discovery"
	"prismapply/api/internal/jobs"
	"prismapply/api/internal/obslog"
	"prismapply/api/internal/r2"
	"prismapply/api/internal/redisx"
	"prismapply/api/internal/tailoring"
)

func main() {
	obslog.Init("prismapply-jobworker")

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
		slog.Error("redis init failed", "error", err)
		os.Exit(1)
	}
	defer func() { _ = rdb.Close() }()
	if err := redisx.Ping(ctx, rdb); err != nil {
		slog.Error("redis ping failed", "error", err)
		os.Exit(1)
	}

	r2Client := r2.New(cfg.R2Endpoint, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2Bucket, cfg.R2PublicURL)

	sigCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	slog.Info("jobworker listening",
		"match_queue", cfg.MatchQueueKey,
		"process_queue", cfg.JobProcessQueueKey,
	)

	for {
		vals, err := rdb.BRPop(sigCtx, 5*time.Second, cfg.MatchQueueKey, cfg.JobProcessQueueKey).Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				continue
			}
			if sigCtx.Err() != nil {
				slog.Info("shutdown")
				return
			}
			slog.Warn("brpop failed", "error", err)
			time.Sleep(time.Second)
			continue
		}
		if len(vals) != 2 {
			continue
		}
		queueKey := vals[0]
		raw := []byte(vals[1])

		switch queueKey {
		case cfg.MatchQueueKey:
			handleMatch(sigCtx, cfg, pool, rdb, r2Client, raw)
		case cfg.JobProcessQueueKey:
			handleProcessJob(sigCtx, cfg, pool, rdb, raw)
		}
	}
}

func handleMatch(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, rdb *redis.Client, r2Client *r2.Client, raw []byte) {
	var p jobs.MatchPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		slog.Error("invalid match payload", "error", err)
		_ = jobs.PushDLQ(ctx, rdb, cfg.MatchQueueKey, raw, err.Error())
		return
	}

	idempotencyKey := fmt.Sprintf("tailor:%d", p.MatchID)
	runID, done, err := jobs.BeginRun(ctx, pool, "tailor", idempotencyKey, p)
	if err != nil {
		slog.Error("begin run failed", "match_id", p.MatchID, "error", err)
		return
	}
	if done {
		slog.Info("tailor_already_completed", "match_id", p.MatchID)
		return
	}

	locked, err := jobs.TryLockTailor(ctx, rdb, p.MatchID, 30*time.Minute)
	if err != nil {
		slog.Warn("tailor lock failed", "match_id", p.MatchID, "error", err)
	}
	if !locked {
		slog.Info("tailor_already_running", "match_id", p.MatchID)
		return
	}

	err = tailoring.TailorMatch(ctx, cfg, pool, r2Client, p.MatchID)
	if err != nil {
		_ = jobs.UnlockTailor(ctx, rdb, p.MatchID)
		attempts, _ := jobs.GetRunAttempts(ctx, pool, idempotencyKey)
		_ = jobs.FailRun(ctx, pool, runID, err.Error())
		if jobs.ShouldRetry(attempts) {
			time.Sleep(jobs.Backoff(attempts))
			_ = jobs.EnqueueMatch(ctx, rdb, p.MatchID)
		} else {
			_ = jobs.PushDLQ(ctx, rdb, cfg.JobsDLQKey, raw, err.Error())
		}
		slog.Error("tailor failed", "match_id", p.MatchID, "error", err)
		return
	}
	_ = jobs.CompleteRun(ctx, pool, runID)
	slog.Info("tailor_complete", "match_id", p.MatchID)
}

func handleProcessJob(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, rdb *redis.Client, raw []byte) {
	var p jobs.ProcessJobPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		slog.Error("invalid process job payload", "error", err)
		_ = jobs.PushDLQ(ctx, rdb, cfg.JobProcessQueueKey, raw, err.Error())
		return
	}
	if err := discovery.ProcessJob(ctx, cfg, pool, rdb, p.JobID); err != nil {
		_ = jobs.PushDLQ(ctx, rdb, cfg.JobsDLQKey, raw, err.Error())
		slog.Error("process_job_failed", "job_id", p.JobID, "error", err)
		return
	}
}
