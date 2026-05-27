ALTER TABLE tailored_applications
    ADD COLUMN IF NOT EXISTS cover_letter_pdf_url TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS cover_letter_filename TEXT;
