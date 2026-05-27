package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// RunStatus values for job_runs table.
const (
	RunStatusPending   = "pending"
	RunStatusRunning   = "running"
	RunStatusCompleted = "completed"
	RunStatusFailed    = "failed"
)

// BeginRun claims an idempotent job run or returns existing completed run.
func BeginRun(ctx context.Context, pool *pgxpool.Pool, jobType, idempotencyKey string, payload any) (runID int64, alreadyDone bool, err error) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return 0, false, err
	}

	var existingStatus string
	var existingID int64
	err = pool.QueryRow(ctx, `SELECT id, status FROM job_runs WHERE idempotency_key = $1`, idempotencyKey).Scan(&existingID, &existingStatus)
	if err == nil {
		if existingStatus == RunStatusCompleted {
			return existingID, true, nil
		}
		_, err = pool.Exec(ctx, `
			UPDATE job_runs SET status = $2, attempts = attempts + 1, updated_at = now()
			WHERE id = $1`, existingID, RunStatusRunning)
		return existingID, false, err
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return 0, false, err
	}

	err = pool.QueryRow(ctx, `
		INSERT INTO job_runs (job_type, idempotency_key, payload, status, attempts, updated_at)
		VALUES ($1, $2, $3::jsonb, $4, 1, now())
		RETURNING id`, jobType, idempotencyKey, raw, RunStatusRunning).Scan(&runID)
	return runID, false, err
}

// CompleteRun marks a job run successful.
func CompleteRun(ctx context.Context, pool *pgxpool.Pool, runID int64) error {
	_, err := pool.Exec(ctx, `
		UPDATE job_runs SET status = $2, updated_at = now(), completed_at = now(), last_error = NULL
		WHERE id = $1`, runID, RunStatusCompleted)
	return err
}

// FailRun records failure on a job run.
func FailRun(ctx context.Context, pool *pgxpool.Pool, runID int64, reason string) error {
	_, err := pool.Exec(ctx, `
		UPDATE job_runs SET status = $2, last_error = $3, updated_at = now()
		WHERE id = $1`, runID, RunStatusFailed, reason)
	return err
}

// GetRunAttempts returns attempt count for idempotency key.
func GetRunAttempts(ctx context.Context, pool *pgxpool.Pool, idempotencyKey string) (int, error) {
	var attempts int
	err := pool.QueryRow(ctx, `SELECT attempts FROM job_runs WHERE idempotency_key = $1`, idempotencyKey).Scan(&attempts)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, nil
	}
	return attempts, err
}

// ShouldRetry reports whether another attempt is allowed.
func ShouldRetry(attempts int) bool {
	return attempts < MaxAttempts
}

// Backoff returns exponential backoff duration for attempt n (1-based).
func Backoff(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	d := time.Duration(1<<uint(attempt-1)) * 10 * time.Second
	if d > 2*time.Minute {
		return 2 * time.Minute
	}
	return d
}
