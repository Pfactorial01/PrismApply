ALTER TABLE tailored_applications
    DROP COLUMN IF EXISTS cover_letter_pdf_url,
    DROP COLUMN IF EXISTS cover_letter_filename;
