package repo

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type JobMatchRow struct {
	UserID       uuid.UUID
	MatchedCount int
	AvgScore     float64
}

type EmbeddingVector []float32

func parseVector(raw string) ([]float32, error) {
	s := strings.Trim(raw, "[]")
	if s == "" {
		return nil, nil
	}
	parts := strings.Split(s, ",")
	vec := make([]float32, len(parts))
	for i, p := range parts {
		var f float64
		if err := json.Unmarshal([]byte(strings.TrimSpace(p)), &f); err != nil {
			return nil, err
		}
		vec[i] = float32(f)
	}
	return vec, nil
}

func GetJobEmbedding(ctx context.Context, pool *pgxpool.Pool, jobID uuid.UUID) ([]float32, error) {
	var raw []byte
	err := pool.QueryRow(ctx, `SELECT embedding::text FROM discovered_jobs WHERE id = $1`, jobID).Scan(&raw)
	if err != nil {
		return nil, err
	}

	var vec []float32
	s := strings.Trim(string(raw), "[]")
	if s == "" {
		return vec, nil
	}
	parts := strings.Split(s, ",")
	vec = make([]float32, len(parts))
	for i, p := range parts {
		var f float64
		if e := json.Unmarshal([]byte(strings.TrimSpace(p)), &f); e != nil {
			return nil, e
		}
		vec[i] = float32(f)
	}
	return vec, nil
}

func FindMatchingUsers(ctx context.Context, pool *pgxpool.Pool, embedding []float32, threshold float64, limit int) ([]JobMatchRow, error) {
	lit := FormatVector(embedding)
	rows, err := pool.Query(ctx, `
		SELECT pec.user_id,
		       COUNT(*)::int AS matched_chunks,
		       AVG(1 - (pec.embedding <=> $1::vector))::float8 AS avg_similarity
		FROM profile_embedding_chunks pec
		WHERE 1 - (pec.embedding <=> $1::vector) > $2
		GROUP BY pec.user_id
		ORDER BY avg_similarity DESC
		LIMIT $3`, lit, threshold, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []JobMatchRow
	for rows.Next() {
		var r JobMatchRow
		if err := rows.Scan(&r.UserID, &r.MatchedCount, &r.AvgScore); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func InsertJobMatches(ctx context.Context, pool *pgxpool.Pool, jobID uuid.UUID, matches []JobMatchRow) ([]int64, error) {
	if len(matches) == 0 {
		return nil, nil
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var ids []int64
	for _, m := range matches {
		var id int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO job_matches (user_id, job_id, score, matched_chunks, status)
			VALUES ($1, $2, $3, $4, 'pending')
			ON CONFLICT (user_id, job_id) DO NOTHING
			RETURNING id`,
			m.UserID, jobID, float32(m.AvgScore), m.MatchedCount).Scan(&id); err != nil {
			// Skip conflict rows (already matched)
			continue
		}
		ids = append(ids, id)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return ids, nil
}
