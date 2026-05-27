package repo

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EnsureTailorJob inserts a tailor_jobs row if none exists for (user_id, job_id).
// idempotency_key is stored for client correlation; defaults to tailor:<job_id> when empty.
// created is false when a row already existed for that job.
func EnsureTailorJob(ctx context.Context, pool *pgxpool.Pool, userID, jobID uuid.UUID, idempotencyKey string) (id uuid.UUID, created bool, err error) {
	if idempotencyKey == "" {
		idempotencyKey = "tailor:" + jobID.String()
	}
	err = pool.QueryRow(ctx, `
		INSERT INTO tailor_jobs (user_id, job_id, idempotency_key, status)
		VALUES ($1, $2, $3, 'queued')
		ON CONFLICT (user_id, job_id) DO NOTHING
		RETURNING id`,
		userID, jobID, idempotencyKey).Scan(&id)
	if err == nil {
		return id, true, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		err = pool.QueryRow(ctx, `
			SELECT id FROM tailor_jobs WHERE user_id = $1 AND job_id = $2`,
			userID, jobID).Scan(&id)
		if err != nil {
			return uuid.Nil, false, err
		}
		return id, false, nil
	}
	return uuid.Nil, false, err
}
