CREATE TABLE IF NOT EXISTS discovery_search_queries (
    id BIGSERIAL PRIMARY KEY,
    query TEXT NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT true,
    priority INT NOT NULL DEFAULT 100,
    last_run_at TIMESTAMPTZ,
    last_result_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_search_queries_active
    ON discovery_search_queries (active, priority, id);

ALTER TABLE discovered_jobs
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS search_query_id BIGINT REFERENCES discovery_search_queries (id);

UPDATE discovered_jobs SET last_seen_at = discovered_at WHERE last_seen_at IS NULL;
