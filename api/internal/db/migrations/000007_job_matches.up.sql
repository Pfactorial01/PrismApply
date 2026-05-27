CREATE TABLE IF NOT EXISTS job_matches (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES discovered_jobs (id) ON DELETE CASCADE,
    score REAL NOT NULL,
    matched_chunks INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_matches_user_status ON job_matches (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_matches_job ON job_matches (job_id);
