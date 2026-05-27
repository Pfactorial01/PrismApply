package repo

import (
	"context"
	"crypto/sha256"
	"encoding/hex"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ProfileEmbeddingChunk is one RAG slice for a user profile.
type ProfileEmbeddingChunk struct {
	ChunkIndex int
	Content    string
	Embedding  []float32
}

func contentSHA256(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

// ReplaceProfileEmbeddingChunks deletes existing chunks for the user and inserts the new set in one transaction.
func ReplaceProfileEmbeddingChunks(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID, chunks []ProfileEmbeddingChunk) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `DELETE FROM profile_embedding_chunks WHERE user_id = $1`, userID); err != nil {
		return err
	}
	for _, c := range chunks {
		if c.Content == "" {
			continue
		}
		lit := FormatVector(c.Embedding)
		hash := contentSHA256(c.Content)
		if _, err := tx.Exec(ctx, `
			INSERT INTO profile_embedding_chunks (user_id, chunk_index, content, content_sha256, embedding)
			VALUES ($1, $2, $3, $4, $5::vector)`,
			userID, c.ChunkIndex, c.Content, hash, lit); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
