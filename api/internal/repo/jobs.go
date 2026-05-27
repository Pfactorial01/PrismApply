package repo

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/embeddings"
)

// UpsertJobByURL inserts or updates a job row keyed by canonical URL hash per user.
// created is true when a new row was inserted.
func UpsertJobByURL(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, sourceURL, title, company, rawDescription string) (id uuid.UUID, created bool, err error) {
	canon := embeddings.CanonicalJobURL(sourceURL)
	if canon == "" {
		return uuid.Nil, false, errors.New("empty job URL")
	}
	hash := embeddings.SHA256Hex(canon)

	err = pool.QueryRow(ctx, `SELECT id FROM jobs WHERE user_id = $1 AND url_sha256 = $2`, userID, hash).Scan(&id)
	if err == nil {
		_, uerr := pool.Exec(ctx, `
			UPDATE jobs
			SET source_url = $2, title = $3, company = $4, raw_description = $5, updated_at = now()
			WHERE id = $1`,
			id, sourceURL, title, company, rawDescription)
		return id, false, uerr
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, false, err
	}

	err = pool.QueryRow(ctx, `
		INSERT INTO jobs (user_id, source_url, url_sha256, title, company, raw_description)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id`,
		userID, sourceURL, hash, title, company, rawDescription).Scan(&id)
	if err != nil {
		return uuid.Nil, false, err
	}
	return id, true, nil
}
