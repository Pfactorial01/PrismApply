package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/config"
	"prismapply/api/internal/db"
	"prismapply/api/internal/repo"
	"prismapply/api/internal/seeddata"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lshortfile)

	cfg := config.FromEnv()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if !json.Valid(seeddata.SampleApplicantProfileJSON) {
		log.Fatal("embedded sample profile is not valid JSON")
	}

	ctx := context.Background()
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer pool.Close()

	id, err := firstUserID(ctx, pool)
	if err != nil {
		log.Fatalf("lookup user: %v", err)
	}

	if err := repo.UpsertProfile(ctx, pool, id, seeddata.SampleApplicantProfileJSON); err != nil {
		log.Fatalf("upsert profile: %v", err)
	}
	log.Printf("seeded applicant profile JSON for user %s", id)
}

func firstUserID(ctx context.Context, pool *pgxpool.Pool) (uuid.UUID, error) {
	var id uuid.UUID
	err := pool.QueryRow(ctx, `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`).Scan(&id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, errors.New("no users in database; create a user via signup first")
		}
		return uuid.Nil, err
	}
	return id, nil
}
