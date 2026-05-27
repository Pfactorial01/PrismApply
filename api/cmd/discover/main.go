package main

import (
	"context"
	"flag"
	"log/slog"
	"os"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/discovery"
	"prismapply/api/internal/obslog"
	"prismapply/api/internal/redisx"
)

func main() {
	obslog.Init("prismapply-discover")

	maxScrapes := flag.Int("max-scrapes", 0, "max new URLs to scrape (0 = use DISCOVERY_MAX_SCRAPES_PER_RUN)")
	flag.Parse()

	cfg := config.FromEnv()
	if cfg.DatabaseURL == "" {
		slog.Error("missing DATABASE_URL")
		os.Exit(1)
	}
	if !cfg.DiscoveryEnabled {
		slog.Info("discovery disabled (DISCOVERY_ENABLED=false)")
		return
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

	result, err := discovery.Run(ctx, cfg, pool, rdb, *maxScrapes)
	if err != nil {
		slog.Error("discovery run failed", "error", err)
		os.Exit(1)
	}

	slog.Info("discovery finished",
		"queries_run", result.QueriesRun,
		"jobs_stored", result.JobsStored,
		"match_jobs_enqueued", result.MatchJobsEnqueued,
		"errors", result.Errors,
	)
}
