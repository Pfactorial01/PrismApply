ALTER TABLE tailored_applications ADD COLUMN IF NOT EXISTS form_answers JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE tailored_applications ADD COLUMN IF NOT EXISTS submission_error TEXT;
