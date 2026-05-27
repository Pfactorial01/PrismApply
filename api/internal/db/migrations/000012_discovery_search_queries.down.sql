ALTER TABLE discovered_jobs
    DROP COLUMN IF EXISTS search_query_id,
    DROP COLUMN IF EXISTS last_seen_at;

DROP TABLE IF EXISTS discovery_search_queries;
