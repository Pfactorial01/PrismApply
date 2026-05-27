// Enqueue-match pushes a match ID to the tailor queue.
// Usage: REDIS_URL=... go run ./cmd/enqueue-match <match_id>
package main

import (
	"context"
	"fmt"
	"os"
	"strconv"

	"github.com/redis/go-redis/v9"

	"prismapply/api/internal/jobs"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: go run ./cmd/enqueue-match <match_id>")
		os.Exit(1)
	}
	matchID, err := strconv.ParseInt(os.Args[1], 10, 64)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		fmt.Fprintln(os.Stderr, "REDIS_URL required")
		os.Exit(1)
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()
	if err := jobs.EnqueueMatch(context.Background(), rdb, matchID); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("enqueued match_id=%d\n", matchID)
}
