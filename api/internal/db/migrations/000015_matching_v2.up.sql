-- Matching v2: structured preferences, job facts, section embeddings, match metadata

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS preferences_json JSONB;

ALTER TABLE profile_embedding_chunks
    ADD COLUMN IF NOT EXISTS section_key TEXT NOT NULL DEFAULT 'legacy';

CREATE INDEX IF NOT EXISTS idx_profile_embedding_chunks_section
    ON profile_embedding_chunks (user_id, section_key);

ALTER TABLE discovered_jobs
    ADD COLUMN IF NOT EXISTS remote_policy TEXT,
    ADD COLUMN IF NOT EXISTS employment_type TEXT,
    ADD COLUMN IF NOT EXISTS seniority_level TEXT,
    ADD COLUMN IF NOT EXISTS requires_sponsorship BOOLEAN,
    ADD COLUMN IF NOT EXISTS industry_tags TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS has_heavy_oncall BOOLEAN,
    ADD COLUMN IF NOT EXISTS job_facts_json JSONB;

ALTER TABLE job_matches
    ADD COLUMN IF NOT EXISTS gate_passed BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS score_breakdown JSONB,
    ADD COLUMN IF NOT EXISTS match_reason JSONB,
    ADD COLUMN IF NOT EXISTS adjudication JSONB;

CREATE TABLE IF NOT EXISTS job_embedding_sections (
    id BIGSERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES discovered_jobs (id) ON DELETE CASCADE,
    section_key TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (job_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_job_embedding_sections_job
    ON job_embedding_sections (job_id);

CREATE INDEX IF NOT EXISTS idx_job_embedding_sections_hnsw
    ON job_embedding_sections
    USING hnsw (embedding vector_cosine_ops);
