-- RAG-oriented profile chunks (one row per slice of profile text). HNSW index for cosine similarity.
CREATE TABLE IF NOT EXISTS profile_embedding_chunks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    content TEXT NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_profile_embedding_chunks_user ON profile_embedding_chunks (user_id);
CREATE INDEX IF NOT EXISTS idx_profile_embedding_chunks_sha ON profile_embedding_chunks (user_id, content_sha256);

CREATE INDEX IF NOT EXISTS idx_profile_embedding_chunks_embedding_hnsw
    ON profile_embedding_chunks
    USING hnsw (embedding vector_cosine_ops);
