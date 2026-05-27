// One-shot tailor run for a match ID.
// Usage: go run ./cmd/tailor-match 635
package main

import (
	"context"
	"fmt"
	"os"
	"strconv"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/obslog"
	"prismapply/api/internal/r2"
	"prismapply/api/internal/tailoring"
)

func main() {
	obslog.Init("prismapply-tailor-match")

	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/tailor-match <match_id>")
		os.Exit(1)
	}
	matchID, err := strconv.ParseInt(os.Args[1], 10, 64)
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid match_id: %v\n", err)
		os.Exit(1)
	}

	cfg := config.FromEnv()
	ctx := context.Background()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "db: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	r2Client := r2.New(cfg.R2Endpoint, cfg.R2AccessKeyID, cfg.R2SecretAccessKey, cfg.R2Bucket, cfg.R2PublicURL)

	fmt.Printf("tailoring match_id=%d...\n", matchID)
	if err := tailoring.TailorMatch(ctx, cfg, pool, r2Client, matchID); err != nil {
		fmt.Fprintf(os.Stderr, "tailor failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("tailor complete match_id=%d\n", matchID)
}
