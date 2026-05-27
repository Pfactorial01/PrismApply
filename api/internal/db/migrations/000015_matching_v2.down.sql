DROP INDEX IF EXISTS idx_job_embedding_sections_hnsw;
DROP INDEX IF EXISTS idx_job_embedding_sections_job;
DROP TABLE IF EXISTS job_embedding_sections;

ALTER TABLE job_matches
    DROP COLUMN IF EXISTS adjudication,
    DROP COLUMN IF EXISTS match_reason,
    DROP COLUMN IF EXISTS score_breakdown,
    DROP COLUMN IF EXISTS gate_passed;

ALTER TABLE discovered_jobs
    DROP COLUMN IF EXISTS job_facts_json,
    DROP COLUMN IF EXISTS has_heavy_oncall,
    DROP COLUMN IF EXISTS industry_tags,
    DROP COLUMN IF EXISTS requires_sponsorship,
    DROP COLUMN IF EXISTS seniority_level,
    DROP COLUMN IF EXISTS employment_type,
    DROP COLUMN IF EXISTS remote_policy;

DROP INDEX IF EXISTS idx_profile_embedding_chunks_section;
ALTER TABLE profile_embedding_chunks DROP COLUMN IF EXISTS section_key;

ALTER TABLE user_profiles DROP COLUMN IF EXISTS preferences_json;
