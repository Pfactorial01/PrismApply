package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"prismapply/api/internal/auth"
	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/handlers"
	"prismapply/api/internal/obslog"
	"prismapply/api/internal/r2"
	"prismapply/api/internal/redisx"
	"prismapply/api/internal/server"
)

func main() {
	obslog.Init("prismapply-api")

	cfg := config.FromEnv()
	if cfg.DatabaseURL == "" {
		slog.Error("missing DATABASE_URL")
		os.Exit(1)
	}

	ctx := context.Background()

	if err := db.Migrate(config.ToPgxMigrateDSN(cfg.DatabaseURL)); err != nil {
		slog.Error("migrate failed", "error", err)
		os.Exit(1)
	}

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
			slog.Error("redis NOAUTH — set REDIS_PASSWORD or REDIS_URL in api/.env, or use make run-dev-redis")
			os.Exit(1)
		}
		slog.Error("redis ping failed", "error", err)
		os.Exit(1)
	}

	r2Client := r2.New(cfg.R2Endpoint, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2Bucket, cfg.R2PublicURL)

	authSvc := auth.NewService(cfg, pool, rdb)
	h := handlers.NewHandlers(pool, authSvc, rdb, cfg.EmbeddingQueueKey, r2Client, cfg)
	router := server.NewRouter(h)

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("api listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("listen failed", "error", err)
			os.Exit(1)
		}
	}()

	sigCtx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-sigCtx.Done()

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Warn("graceful shutdown", "error", err)
	}
}
