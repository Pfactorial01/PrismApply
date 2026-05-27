package redisx

import (
	"context"
	"fmt"
	"strings"

	"github.com/redis/go-redis/v9"
	"prismapply/api/internal/config"
)

// New builds a Redis client. If cfg.RedisURL is set, it must be a full redis:// or rediss:// URL
// (see REDIS_URL in env.example); otherwise Addr, Password, and DB are used.
func New(cfg config.Config) (*redis.Client, error) {
	if u := strings.TrimSpace(cfg.RedisURL); u != "" {
		opt, err := redis.ParseURL(u)
		if err != nil {
			return nil, fmt.Errorf("REDIS_URL: %w", err)
		}
		return redis.NewClient(opt), nil
	}
	return redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	}), nil
}

func Ping(ctx context.Context, c *redis.Client) error {
	if err := c.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("redis ping: %w", err)
	}
	return nil
}

// IsNOAUTH reports whether the error indicates Redis rejected missing/wrong credentials.
func IsNOAUTH(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "NOAUTH")
}
