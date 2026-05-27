package repo

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/matching"
)

type ApplicationMatchReason struct {
	Gate      matching.GateResult `json:"gate"`
	Direction string              `json:"direction,omitempty"`
	Strengths []string            `json:"strengths,omitempty"`
	Gaps      []string            `json:"gaps,omitempty"`
}

type JobFormField struct {
	Label     string `json:"label"`
	FieldType string `json:"fieldType"`
	Required  bool   `json:"required"`
	Position  int    `json:"position"`
}

type TailoredApplication struct {
	ID                  uuid.UUID                   `json:"id"`
	JobID               uuid.UUID                   `json:"jobId"`
	MatchID             int64                       `json:"matchId"`
	Title               string                      `json:"title"`
	Company             string                      `json:"company"`
	Location            *string                     `json:"location"`
	ApplyURL            string                      `json:"applyUrl"`
	TailoredResume      string                      `json:"tailoredResume"`
	TailoredCoverLetter string                      `json:"tailoredCoverLetter"`
	ResumePdfURL        string                      `json:"resumePdfUrl"`
	ResumeFilename      string                      `json:"resumeFilename,omitempty"`
	CoverLetterPdfURL   string                      `json:"coverLetterPdfUrl"`
	CoverLetterFilename string                      `json:"coverLetterFilename,omitempty"`
	FormAnswers         json.RawMessage             `json:"formAnswers"`
	JobFormFields       json.RawMessage             `json:"jobFormFields"`
	Status              string                      `json:"status"`
	MarkedSent          bool                        `json:"markedSent"`
	SentAt              *time.Time                  `json:"sentAt"`
	CreatedAt           time.Time                   `json:"createdAt"`
	MatchScore          *float32                    `json:"matchScore,omitempty"`
	MatchedChunks       *int                        `json:"matchedChunks,omitempty"`
	GatePassed          *bool                       `json:"gatePassed,omitempty"`
	ScoreBreakdown      *matching.ScoreBreakdown    `json:"scoreBreakdown,omitempty"`
	MatchReason         *ApplicationMatchReason     `json:"matchReason,omitempty"`
	Adjudication        *matching.AdjudicationResult `json:"adjudication,omitempty"`
	MatchTier           *string                     `json:"matchTier,omitempty"`
	MatchTierLabel      string                      `json:"matchTierLabel,omitempty"`
}

func GetTailoredApplications(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) ([]TailoredApplication, error) {
	rows, err := pool.Query(ctx, `
		SELECT ta.id, ta.job_id, ta.match_id, dj.title, dj.company, dj.location, dj.apply_url,
		       ta.tailored_resume, ta.tailored_cover_letter, ta.resume_pdf_url, COALESCE(ta.resume_filename, ''),
		       COALESCE(ta.cover_letter_pdf_url, ''), COALESCE(ta.cover_letter_filename, ''),
		       ta.form_answers,
		       COALESCE(
		         (SELECT json_agg(json_build_object(
		            'label', jff.label,
		            'fieldType', jff.field_type,
		            'required', jff.required,
		            'position', jff.position
		          ) ORDER BY jff.position)
		          FROM job_form_fields jff WHERE jff.job_id = ta.job_id),
		         '[]'::json
		       ),
		       ta.status, ta.marked_sent, ta.sent_at, ta.created_at,
		       jm.score, jm.matched_chunks, jm.gate_passed, jm.score_breakdown, jm.match_reason, jm.adjudication
		FROM tailored_applications ta
		JOIN discovered_jobs dj ON dj.id = ta.job_id
		LEFT JOIN job_matches jm ON jm.id = ta.match_id
		WHERE ta.user_id = $1
		ORDER BY ta.created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []TailoredApplication
	for rows.Next() {
		var a TailoredApplication
		var formAnswers []byte
		var jobFormFields []byte
		var score *float32
		var matchedChunks *int
		var gatePassed *bool
		var scoreBreakdownRaw, matchReasonRaw, adjudicationRaw []byte

		err := rows.Scan(
			&a.ID, &a.JobID, &a.MatchID,
			&a.Title, &a.Company, &a.Location, &a.ApplyURL,
			&a.TailoredResume, &a.TailoredCoverLetter, &a.ResumePdfURL, &a.ResumeFilename,
			&a.CoverLetterPdfURL, &a.CoverLetterFilename, &formAnswers,
			&jobFormFields,
			&a.Status, &a.MarkedSent, &a.SentAt, &a.CreatedAt,
			&score, &matchedChunks, &gatePassed, &scoreBreakdownRaw, &matchReasonRaw, &adjudicationRaw,
		)
		if err != nil {
			return nil, err
		}
		if formAnswers != nil {
			a.FormAnswers = json.RawMessage(formAnswers)
		} else {
			a.FormAnswers = json.RawMessage("[]")
		}
		if jobFormFields != nil {
			a.JobFormFields = DedupeJobFormFieldsJSON(jobFormFields)
		} else {
			a.JobFormFields = json.RawMessage("[]")
		}
		a.MatchScore = score
		a.MatchedChunks = matchedChunks
		a.GatePassed = gatePassed
		if len(scoreBreakdownRaw) > 0 {
			var bd matching.ScoreBreakdown
			if json.Unmarshal(scoreBreakdownRaw, &bd) == nil {
				a.ScoreBreakdown = &bd
			}
		}
		if len(matchReasonRaw) > 0 {
			var mr ApplicationMatchReason
			if json.Unmarshal(matchReasonRaw, &mr) == nil {
				a.MatchReason = &mr
			}
		}
		if len(adjudicationRaw) > 0 {
			var adj matching.AdjudicationResult
			if json.Unmarshal(adjudicationRaw, &adj) == nil {
				a.Adjudication = &adj
			}
		}
		a.MatchTier = matching.ClassifyMatchTier(score, a.ScoreBreakdown, a.Adjudication)
		if a.MatchTier != nil {
			a.MatchTierLabel = matching.MatchTierLabel(*a.MatchTier)
		}
		apps = append(apps, a)
	}
	return apps, rows.Err()
}

func GetTailoredApplicationByID(ctx context.Context, pool *pgxpool.Pool, userID, appID uuid.UUID) (*TailoredApplication, error) {
	row := pool.QueryRow(ctx, `
		SELECT ta.id, ta.job_id, ta.match_id, dj.title, dj.company, dj.location, dj.apply_url,
		       ta.tailored_resume, ta.tailored_cover_letter, ta.resume_pdf_url, COALESCE(ta.resume_filename, ''),
		       COALESCE(ta.cover_letter_pdf_url, ''), COALESCE(ta.cover_letter_filename, ''),
		       ta.form_answers,
		       COALESCE(
		         (SELECT json_agg(json_build_object(
		            'label', jff.label,
		            'fieldType', jff.field_type,
		            'required', jff.required,
		            'position', jff.position
		          ) ORDER BY jff.position)
		          FROM job_form_fields jff WHERE jff.job_id = ta.job_id),
		         '[]'::json
		       ),
		       ta.status, ta.marked_sent, ta.sent_at, ta.created_at,
		       jm.score, jm.matched_chunks, jm.gate_passed, jm.score_breakdown, jm.match_reason, jm.adjudication
		FROM tailored_applications ta
		JOIN discovered_jobs dj ON dj.id = ta.job_id
		LEFT JOIN job_matches jm ON jm.id = ta.match_id
		WHERE ta.user_id = $1 AND ta.id = $2`,
		userID, appID,
	)

	var a TailoredApplication
	var formAnswers []byte
	var jobFormFields []byte
	var score *float32
	var matchedChunks *int
	var gatePassed *bool
	var scoreBreakdownRaw, matchReasonRaw, adjudicationRaw []byte

	err := row.Scan(
		&a.ID, &a.JobID, &a.MatchID,
		&a.Title, &a.Company, &a.Location, &a.ApplyURL,
		&a.TailoredResume, &a.TailoredCoverLetter, &a.ResumePdfURL, &a.ResumeFilename, &formAnswers,
		&jobFormFields,
		&a.Status, &a.MarkedSent, &a.SentAt, &a.CreatedAt,
		&score, &matchedChunks, &gatePassed, &scoreBreakdownRaw, &matchReasonRaw, &adjudicationRaw,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if formAnswers != nil {
		a.FormAnswers = json.RawMessage(formAnswers)
	} else {
		a.FormAnswers = json.RawMessage("[]")
	}
	if jobFormFields != nil {
		a.JobFormFields = DedupeJobFormFieldsJSON(jobFormFields)
	} else {
		a.JobFormFields = json.RawMessage("[]")
	}
	a.MatchScore = score
	a.MatchedChunks = matchedChunks
	a.GatePassed = gatePassed
	if len(scoreBreakdownRaw) > 0 {
		var bd matching.ScoreBreakdown
		if json.Unmarshal(scoreBreakdownRaw, &bd) == nil {
			a.ScoreBreakdown = &bd
		}
	}
	if len(matchReasonRaw) > 0 {
		var mr ApplicationMatchReason
		if json.Unmarshal(matchReasonRaw, &mr) == nil {
			a.MatchReason = &mr
		}
	}
	if len(adjudicationRaw) > 0 {
		var adj matching.AdjudicationResult
		if json.Unmarshal(adjudicationRaw, &adj) == nil {
			a.Adjudication = &adj
		}
	}
	a.MatchTier = matching.ClassifyMatchTier(score, a.ScoreBreakdown, a.Adjudication)
	if a.MatchTier != nil {
		a.MatchTierLabel = matching.MatchTierLabel(*a.MatchTier)
	}
	return &a, nil
}

func MarkApplicationSent(ctx context.Context, pool *pgxpool.Pool, userID, appID uuid.UUID) error {
	_, err := pool.Exec(ctx, `
		UPDATE tailored_applications
		SET marked_sent = true, sent_at = now(), updated_at = now()
		WHERE id = $1 AND user_id = $2`,
		appID, userID,
	)
	return err
}

func UnmarkApplicationSent(ctx context.Context, pool *pgxpool.Pool, userID, appID uuid.UUID) error {
	_, err := pool.Exec(ctx, `
		UPDATE tailored_applications
		SET marked_sent = false, sent_at = NULL, updated_at = now()
		WHERE id = $1 AND user_id = $2`,
		appID, userID,
	)
	return err
}
