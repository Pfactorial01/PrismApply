package embedqueue

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const (
	// DefaultQueueKey is the Redis list used for profile embedding jobs (RPUSH / BRPOP).
	DefaultQueueKey = "prismapply:embed:profile"
	// DefaultDLQKey receives jobs that failed after dequeue (inspect with LRANGE).
	DefaultDLQKey = "prismapply:embed:profile:dlq"
)

// ProfileJob is the JSON payload pushed after a successful profile upsert.
type ProfileJob struct {
	UserID    string `json:"user_id"`
	RequestID string `json:"request_id,omitempty"`
}

// IsEmptyProfileJSON reports whether the stored profile document has no keys (skip embed / queue).
func IsEmptyProfileJSON(raw []byte) bool {
	var v any
	if json.Unmarshal(raw, &v) != nil {
		return false
	}
	m, ok := v.(map[string]any)
	return ok && len(m) == 0
}

// ProfileReadyForEmbed is true when the user has finished the wizard and submitted
// (resume on file). Autosave drafts may be partial and must not trigger matching.
func ProfileReadyForEmbed(raw []byte) bool {
	if IsEmptyProfileJSON(raw) {
		return false
	}
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return false
	}
	text, _ := doc["resumePlainText"].(string)
	return strings.TrimSpace(text) != ""
}

// EnqueueProfileEmbed pushes one job onto the Redis list. Caller supplies the list key (from config).
// requestID may be empty; when set it propagates to the worker for log correlation.
func EnqueueProfileEmbed(ctx context.Context, rdb *redis.Client, queueKey string, userID uuid.UUID, requestID string) error {
	if rdb == nil {
		return errors.New("redis client is nil")
	}
	if queueKey == "" {
		queueKey = DefaultQueueKey
	}
	b, err := json.Marshal(ProfileJob{UserID: userID.String(), RequestID: requestID})
	if err != nil {
		return err
	}
	return rdb.RPush(ctx, queueKey, b).Err()
}

// PushDLQ stores a failed job payload plus error reason for inspection.
func PushDLQ(ctx context.Context, rdb *redis.Client, dlqKey string, jobJSON []byte, reason string) error {
	if dlqKey == "" {
		dlqKey = DefaultDLQKey
	}
	payload, err := json.Marshal(map[string]string{
		"job":    string(bytes.TrimSpace(jobJSON)),
		"reason": reason,
	})
	if err != nil {
		return err
	}
	return rdb.LPush(ctx, dlqKey, payload).Err()
}
