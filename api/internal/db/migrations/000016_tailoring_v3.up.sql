-- Tailoring v3: JD requirements cache, structured resume, friendly filenames, audit metadata

ALTER TABLE discovered_jobs
    ADD COLUMN IF NOT EXISTS jd_requirements_json JSONB;

ALTER TABLE tailored_applications
    ADD COLUMN IF NOT EXISTS resume_filename TEXT,
    ADD COLUMN IF NOT EXISTS structured_resume_json JSONB,
    ADD COLUMN IF NOT EXISTS tailor_metadata_json JSONB;
