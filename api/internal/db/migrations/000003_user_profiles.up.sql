-- JSONB mirrors frontend ApplicantProfileDraft; vector column reserved for embeddings / similarity search.
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    profile_summary_embedding vector(1536),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_updated_at ON user_profiles (updated_at);
CREATE INDEX idx_user_profiles_profile_gin ON user_profiles USING gin (profile);
