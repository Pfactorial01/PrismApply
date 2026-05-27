ALTER TABLE tailored_applications
    DROP COLUMN IF EXISTS tailor_metadata_json,
    DROP COLUMN IF EXISTS structured_resume_json,
    DROP COLUMN IF EXISTS resume_filename;

ALTER TABLE discovered_jobs
    DROP COLUMN IF EXISTS jd_requirements_json;
