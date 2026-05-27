-- Drop old user-scoped jobs/tailor_jobs; global discovered_jobs + job_matches replace them.
DROP TABLE IF EXISTS tailor_jobs;
DROP TABLE IF EXISTS jobs;

-- Tailored output for a matched (user, job) pair.
CREATE TABLE IF NOT EXISTS tailored_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES discovered_jobs (id) ON DELETE CASCADE,
    match_id BIGINT NOT NULL REFERENCES job_matches (id) ON DELETE CASCADE,
    tailored_resume TEXT NOT NULL DEFAULT '',
    tailored_cover_letter TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'queued',
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tailored_applications_user ON tailored_applications (user_id, status);
CREATE INDEX IF NOT EXISTS idx_tailored_applications_match ON tailored_applications (match_id);
