package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	MatchQueueKey      = "prismapply:match:new"
	JobProcessQueueKey = "prismapply:job:process"
	JobsDLQKey         = "prismapply:jobs:dlq"
	MaxAttempts        = 3
)

// MatchPayload is enqueued after forward or reverse matching.
type MatchPayload struct {
	MatchID int64 `json:"match_id"`
}

// ProcessJobPayload is enqueued after job discovery store.
type ProcessJobPayload struct {
	JobID string `json:"job_id"`
}

// EnqueueMatch pushes a match ID for tailoring.
func EnqueueMatch(ctx context.Context, rdb *redis.Client, matchID int64) error {
	if rdb == nil {
		return errors.New("redis client is nil")
	}
	b, err := json.Marshal(MatchPayload{MatchID: matchID})
	if err != nil {
		return err
	}
	return rdb.RPush(ctx, MatchQueueKey, b).Err()
}

// EnqueueProcessJob pushes a discovered job for forward matching.
func EnqueueProcessJob(ctx context.Context, rdb *redis.Client, jobID string) error {
	if rdb == nil {
		return errors.New("redis client is nil")
	}
	b, err := json.Marshal(ProcessJobPayload{JobID: jobID})
	if err != nil {
		return err
	}
	return rdb.RPush(ctx, JobProcessQueueKey, b).Err()
}

// DequeueMatch blocks until a match payload is available.
func DequeueMatch(ctx context.Context, rdb *redis.Client, timeout time.Duration) (MatchPayload, []byte, error) {
	raw, err := brpopOne(ctx, rdb, MatchQueueKey, timeout)
	if err != nil {
		return MatchPayload{}, nil, err
	}
	var p MatchPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return MatchPayload{}, raw, err
	}
	return p, raw, nil
}

// DequeueProcessJob blocks until a job process payload is available.
func DequeueProcessJob(ctx context.Context, rdb *redis.Client, timeout time.Duration) (ProcessJobPayload, []byte, error) {
	raw, err := brpopOne(ctx, rdb, JobProcessQueueKey, timeout)
	if err != nil {
		return ProcessJobPayload{}, nil, err
	}
	var p ProcessJobPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return ProcessJobPayload{}, raw, err
	}
	return p, raw, nil
}

func brpopOne(ctx context.Context, rdb *redis.Client, key string, timeout time.Duration) ([]byte, error) {
	vals, err := rdb.BRPop(ctx, timeout, key).Result()
	if err != nil {
		return nil, err
	}
	if len(vals) != 2 {
		return nil, fmt.Errorf("unexpected brpop result for %s", key)
	}
	return []byte(vals[1]), nil
}

// PushDLQ stores a failed job with reason.
func PushDLQ(ctx context.Context, rdb *redis.Client, queueKey string, raw []byte, reason string) error {
	if rdb == nil {
		return errors.New("redis client is nil")
	}
	payload, err := json.Marshal(map[string]string{
		"queue":  queueKey,
		"job":    string(raw),
		"reason": reason,
	})
	if err != nil {
		return err
	}
	return rdb.LPush(ctx, JobsDLQKey, payload).Err()
}

// TryLockTailor acquires idempotency lock for a match tailor run.
func TryLockTailor(ctx context.Context, rdb *redis.Client, matchID int64, ttl time.Duration) (bool, error) {
	if rdb == nil {
		return true, nil
	}
	key := fmt.Sprintf("job:tailor:%d", matchID)
	return rdb.SetNX(ctx, key, "1", ttl).Result()
}

// UnlockTailor releases tailor lock (e.g. on failure for retry).
func UnlockTailor(ctx context.Context, rdb *redis.Client, matchID int64) error {
	if rdb == nil {
		return nil
	}
	key := fmt.Sprintf("job:tailor:%d", matchID)
	return rdb.Del(ctx, key).Err()
}
