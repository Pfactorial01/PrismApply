package tailoring

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/matching"
	"prismapply/api/internal/repo"
)

type tailorInput struct {
	MatchID           int64
	UserID            uuid.UUID
	JobID             uuid.UUID
	JobTitle          string
	JobCompany        string
	JobLocation       *string
	JobDescription    *string
	JobSeniorityLevel *string
	JobFactsJSON      []byte
	FormFields        []FormFieldRow
	ProfileJSON       map[string]any
}

func fetchTailorInput(ctx context.Context, pool *pgxpool.Pool, matchID int64) (*tailorInput, error) {
	var userID, jobID uuid.UUID
	err := pool.QueryRow(ctx, `SELECT user_id, job_id FROM job_matches WHERE id = $1`, matchID).Scan(&userID, &jobID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	var title, company string
	var location, description, seniority *string
	var jobFactsJSON []byte
	err = pool.QueryRow(ctx, `
		SELECT title, company, location, description, seniority_level, job_facts_json
		FROM discovered_jobs WHERE id = $1`, jobID).Scan(&title, &company, &location, &description, &seniority, &jobFactsJSON)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	rows, err := pool.Query(ctx, `
		SELECT label, field_type, required, options, position
		FROM job_form_fields WHERE job_id = $1 ORDER BY position`, jobID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var formFields []FormFieldRow
	for rows.Next() {
		var f FormFieldRow
		var options []byte
		if err := rows.Scan(&f.Label, &f.FieldType, &f.Required, &options, &f.Position); err != nil {
			return nil, err
		}
		if len(options) > 0 && string(options) != "null" {
			_ = json.Unmarshal(options, &f.Options)
		}
		formFields = append(formFields, f)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	formFields = dedupeTailorFormFields(formFields)

	var profileRaw []byte
	var accountEmail string
	err = pool.QueryRow(ctx, `
		SELECT COALESCE(up.profile::text, '{}'), u.email
		FROM users u
		LEFT JOIN user_profiles up ON up.user_id = u.id
		WHERE u.id = $1`, userID).Scan(&profileRaw, &accountEmail)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	var profile map[string]any
	if len(profileRaw) > 0 {
		_ = json.Unmarshal(profileRaw, &profile)
	}
	if profile == nil {
		profile = map[string]any{}
	}
	if profileStr(profile, "email") == "" && strings.TrimSpace(accountEmail) != "" {
		profile["email"] = strings.TrimSpace(accountEmail)
	}

	return &tailorInput{
		MatchID:           matchID,
		UserID:            userID,
		JobID:             jobID,
		JobTitle:          title,
		JobCompany:        company,
		JobLocation:       location,
		JobDescription:    description,
		JobSeniorityLevel: seniority,
		JobFactsJSON:      jobFactsJSON,
		FormFields:        formFields,
		ProfileJSON:       profile,
	}, nil
}

func getJdRequirements(ctx context.Context, pool *pgxpool.Pool, jobID string) (*JdRequirements, error) {
	var raw []byte
	err := pool.QueryRow(ctx, `SELECT jd_requirements_json FROM discovered_jobs WHERE id = $1`, jobID).Scan(&raw)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if len(raw) == 0 || string(raw) == "null" {
		return nil, nil
	}
	var jd JdRequirements
	if err := json.Unmarshal(raw, &jd); err != nil {
		return nil, err
	}
	return &jd, nil
}

func upsertJdRequirements(ctx context.Context, pool *pgxpool.Pool, jobID string, jd JdRequirements) error {
	raw, err := json.Marshal(jd)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `UPDATE discovered_jobs SET jd_requirements_json = $2::jsonb WHERE id = $1`, jobID, raw)
	return err
}

func getProfileEmbeddingSections(ctx context.Context, pool *pgxpool.Pool, userID, jobID string, limit int) ([]ProfileSection, error) {
	uid, err := uuid.Parse(userID)
	if err != nil {
		return nil, err
	}
	jid, err := uuid.Parse(jobID)
	if err != nil {
		return nil, err
	}

	var embText *string
	err = pool.QueryRow(ctx, `SELECT embedding::text FROM discovered_jobs WHERE id = $1 AND embedding IS NOT NULL`, jid).Scan(&embText)
	if err != nil || embText == nil {
		return nil, err
	}

	rows, err := pool.Query(ctx, `
		SELECT section_key, content, 1 - (embedding <=> $1::vector) AS similarity
		FROM profile_embedding_chunks
		WHERE user_id = $2
		ORDER BY embedding <=> $1::vector
		LIMIT $3`, *embText, uid, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ProfileSection
	for rows.Next() {
		var s ProfileSection
		if err := rows.Scan(&s.Key, &s.Content, &s.Score); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func insertTailoredApplication(ctx context.Context, pool *pgxpool.Pool, matchID int64, userID, jobID uuid.UUID, result PipelineResult, formAnswers []FormFieldAnswer, pdfURL string) error {
	stored := make([]map[string]string, len(formAnswers))
	for i, a := range formAnswers {
		stored[i] = map[string]string{"label": a.Label, "value": a.Value}
	}
	formRaw, err := json.Marshal(stored)
	if err != nil {
		return err
	}
	structRaw, err := json.Marshal(result.StructuredResume)
	if err != nil {
		return err
	}
	metaRaw, err := json.Marshal(result.Metadata)
	if err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `DELETE FROM tailored_applications WHERE match_id = $1`, matchID); err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `
		INSERT INTO tailored_applications (
			match_id, user_id, job_id, tailored_resume, tailored_cover_letter,
			form_answers, resume_pdf_url, resume_filename, cover_letter_pdf_url, cover_letter_filename,
			structured_resume_json, tailor_metadata_json, status
		) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12::jsonb, 'completed')`,
		matchID, userID, jobID, result.PlainTextResume, result.CoverLetter,
		formRaw, pdfURL, result.ResumeFilename, result.CoverLetterPDFURL, result.CoverLetterFilename,
		structRaw, metaRaw)
	return err
}

func loadUserPreferences(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (matching.UserPreferences, error) {
	var prefsRaw, profileRaw []byte
	err := pool.QueryRow(ctx, `
		SELECT COALESCE(preferences_json::text, 'null'), profile::text
		FROM user_profiles WHERE user_id = $1`, userID).Scan(&prefsRaw, &profileRaw)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return matching.UserPreferences{}, nil
		}
		return matching.UserPreferences{}, err
	}
	if string(prefsRaw) != "null" && len(prefsRaw) > 2 {
		var prefs matching.UserPreferences
		if err := json.Unmarshal(prefsRaw, &prefs); err == nil {
			return prefs, nil
		}
	}
	return matching.BuildUserPreferences(profileRaw), nil
}

func dedupeTailorFormFields(fields []FormFieldRow) []FormFieldRow {
	if len(fields) <= 1 {
		return fields
	}
	repoFields := make([]repo.FormFieldRow, len(fields))
	for i, f := range fields {
		repoFields[i] = repo.FormFieldRow{
			Label: f.Label, FieldType: f.FieldType, Required: f.Required,
			Options: f.Options, Position: f.Position,
		}
	}
	deduped := repo.DedupeFormFieldsByLabel(repoFields)
	out := make([]FormFieldRow, len(deduped))
	for i, f := range deduped {
		out[i] = FormFieldRow{
			Label: f.Label, FieldType: f.FieldType, Required: f.Required,
			Options: f.Options, Position: f.Position,
		}
	}
	return out
}
