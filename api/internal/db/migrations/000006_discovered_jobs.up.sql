CREATE TABLE IF NOT EXISTS discovered_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    job_url TEXT NOT NULL,
    apply_url TEXT NOT NULL,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    description TEXT,
    raw_data JSONB,
    embedding vector(1536),
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source, job_url)
);

CREATE TABLE IF NOT EXISTS job_form_fields (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES discovered_jobs (id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT false,
    options JSONB,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovered_jobs_source ON discovered_jobs (source, discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_form_fields_job ON job_form_fields (job_id, position);

CREATE INDEX IF NOT EXISTS idx_discovered_jobs_embedding_hnsw
    ON discovered_jobs
    USING hnsw (embedding vector_cosine_ops);
