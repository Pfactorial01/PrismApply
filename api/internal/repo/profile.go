package repo

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// GetProfile returns the JSONB document or "{}" if the user has no row yet.
func GetProfile(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (json.RawMessage, error) {
	var raw []byte
	err := pool.QueryRow(ctx, `SELECT profile FROM user_profiles WHERE user_id = $1`, userID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return json.RawMessage(`{}`), nil
	}
	if err != nil {
		return nil, err
	}
	return json.RawMessage(raw), nil
}

func UpsertProfile(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, profile json.RawMessage) error {
	if !json.Valid(profile) {
		return errors.New("invalid json")
	}
	_, err := pool.Exec(ctx, `
		INSERT INTO user_profiles (user_id, profile, updated_at)
		VALUES ($1, $2::jsonb, now())
		ON CONFLICT (user_id) DO UPDATE
		SET profile = EXCLUDED.profile, updated_at = now()`, userID, profile)
	return err
}

// UpdateProfileSummaryEmbedding sets profile_summary_embedding (vector(1536)) for the user row.
func UpdateProfileSummaryEmbedding(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, embedding []float32) error {
	if len(embedding) != 1536 {
		return errors.New("embedding must have length 1536 for this schema")
	}
	lit := FormatVector(embedding)
	_, err := pool.Exec(ctx, `
		UPDATE user_profiles
		SET profile_summary_embedding = $1::vector, updated_at = now()
		WHERE user_id = $2`, lit, userID)
	return err
}
