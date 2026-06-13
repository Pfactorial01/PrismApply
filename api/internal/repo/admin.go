package repo

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/matching"
)

type AdminStats struct {
	TotalUsers                int `json:"totalUsers"`
	UsersWithProfile          int `json:"usersWithProfile"`
	UsersWithSubmittedProfile int `json:"usersWithSubmittedProfile"`
	TotalMatches              int `json:"totalMatches"`
	MatchesWithApplications   int `json:"matchesWithApplications"`
	PendingMatches            int `json:"pendingMatches"`
	TotalApplications         int `json:"totalApplications"`
	CompletedApplications     int `json:"completedApplications"`
	MarkedSentApplications    int `json:"markedSentApplications"`
	TotalJobs                 int `json:"totalJobs"`
	JobsLast7Days             int `json:"jobsLast7Days"`
	FailedJobRuns             int `json:"failedJobRuns"`
	PendingJobRuns            int `json:"pendingJobRuns"`
}

func GetAdminStats(ctx context.Context, pool *pgxpool.Pool) (AdminStats, error) {
	var s AdminStats
	err := pool.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*)::int FROM users),
			(SELECT COUNT(*)::int FROM user_profiles),
			(SELECT COUNT(*)::int FROM user_profiles WHERE profile->>'profileSubmittedAt' IS NOT NULL AND profile->>'profileSubmittedAt' != ''),
			(SELECT COUNT(*)::int FROM job_matches),
			(SELECT COUNT(DISTINCT match_id)::int FROM tailored_applications),
			(SELECT COUNT(*)::int FROM job_matches WHERE status = 'pending'),
			(SELECT COUNT(*)::int FROM tailored_applications),
			(SELECT COUNT(*)::int FROM tailored_applications WHERE status = 'completed'),
			(SELECT COUNT(*)::int FROM tailored_applications WHERE marked_sent = true),
			(SELECT COUNT(*)::int FROM discovered_jobs),
			(SELECT COUNT(*)::int FROM discovered_jobs WHERE discovered_at >= now() - interval '7 days'),
			(SELECT COUNT(*)::int FROM job_runs WHERE status = 'failed'),
			(SELECT COUNT(*)::int FROM job_runs WHERE status IN ('pending', 'running'))
	`).Scan(
		&s.TotalUsers,
		&s.UsersWithProfile,
		&s.UsersWithSubmittedProfile,
		&s.TotalMatches,
		&s.MatchesWithApplications,
		&s.PendingMatches,
		&s.TotalApplications,
		&s.CompletedApplications,
		&s.MarkedSentApplications,
		&s.TotalJobs,
		&s.JobsLast7Days,
		&s.FailedJobRuns,
		&s.PendingJobRuns,
	)
	return s, err
}

type AdminUserListItem struct {
	ID                 uuid.UUID  `json:"id"`
	Email              string     `json:"email"`
	IsAdmin            bool       `json:"isAdmin"`
	CreatedAt          time.Time  `json:"createdAt"`
	HasProfile         bool       `json:"hasProfile"`
	ProfileSubmittedAt *string    `json:"profileSubmittedAt,omitempty"`
	ProfileUpdatedAt   *time.Time `json:"profileUpdatedAt,omitempty"`
	MatchCount         int        `json:"matchCount"`
	ApplicationCount   int        `json:"applicationCount"`
	SentCount          int        `json:"sentCount"`
}

type AdminListResult[T any] struct {
	Items  []T `json:"items"`
	Total  int `json:"total"`
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

func ListAdminUsers(ctx context.Context, pool *pgxpool.Pool, limit, offset int, search string) (AdminListResult[AdminUserListItem], error) {
	search = strings.TrimSpace(strings.ToLower(search))
	var total int
	countQ := `SELECT COUNT(*)::int FROM users u WHERE ($1 = '' OR lower(u.email) LIKE '%' || $1 || '%')`
	if err := pool.QueryRow(ctx, countQ, search).Scan(&total); err != nil {
		return AdminListResult[AdminUserListItem]{}, err
	}

	rows, err := pool.Query(ctx, `
		SELECT
			u.id, u.email, u.is_admin, u.created_at,
			up.user_id IS NOT NULL,
			up.profile->>'profileSubmittedAt',
			up.updated_at,
			COALESCE((SELECT COUNT(*)::int FROM job_matches jm WHERE jm.user_id = u.id), 0),
			COALESCE((SELECT COUNT(*)::int FROM tailored_applications ta WHERE ta.user_id = u.id), 0),
			COALESCE((SELECT COUNT(*)::int FROM tailored_applications ta WHERE ta.user_id = u.id AND ta.marked_sent = true), 0)
		FROM users u
		LEFT JOIN user_profiles up ON up.user_id = u.id
		WHERE ($1 = '' OR lower(u.email) LIKE '%' || $1 || '%')
		ORDER BY u.created_at DESC
		LIMIT $2 OFFSET $3`, search, limit, offset)
	if err != nil {
		return AdminListResult[AdminUserListItem]{}, err
	}
	defer rows.Close()

	var items []AdminUserListItem
	for rows.Next() {
		var item AdminUserListItem
		var submittedAt *string
		var profileUpdated *time.Time
		if err := rows.Scan(
			&item.ID, &item.Email, &item.IsAdmin, &item.CreatedAt,
			&item.HasProfile, &submittedAt, &profileUpdated,
			&item.MatchCount, &item.ApplicationCount, &item.SentCount,
		); err != nil {
			return AdminListResult[AdminUserListItem]{}, err
		}
		if submittedAt != nil && strings.TrimSpace(*submittedAt) != "" {
			item.ProfileSubmittedAt = submittedAt
		}
		item.ProfileUpdatedAt = profileUpdated
		items = append(items, item)
	}
	if items == nil {
		items = []AdminUserListItem{}
	}
	return AdminListResult[AdminUserListItem]{Items: items, Total: total, Limit: limit, Offset: offset}, rows.Err()
}

type AdminUserDetail struct {
	AdminUserListItem
	Profile json.RawMessage `json:"profile,omitempty"`
}

func GetAdminUserDetail(ctx context.Context, pool *pgxpool.Pool, userID uuid.UUID) (*AdminUserDetail, error) {
	row := pool.QueryRow(ctx, `
		SELECT
			u.id, u.email, u.is_admin, u.created_at,
			up.user_id IS NOT NULL,
			up.profile->>'profileSubmittedAt',
			up.updated_at,
			COALESCE((SELECT COUNT(*)::int FROM job_matches jm WHERE jm.user_id = u.id), 0),
			COALESCE((SELECT COUNT(*)::int FROM tailored_applications ta WHERE ta.user_id = u.id), 0),
			COALESCE((SELECT COUNT(*)::int FROM tailored_applications ta WHERE ta.user_id = u.id AND ta.marked_sent = true), 0),
			up.profile
		FROM users u
		LEFT JOIN user_profiles up ON up.user_id = u.id
		WHERE u.id = $1`, userID)

	var d AdminUserDetail
	var submittedAt *string
	var profileUpdated *time.Time
	var profile []byte
	err := row.Scan(
		&d.ID, &d.Email, &d.IsAdmin, &d.CreatedAt,
		&d.HasProfile, &submittedAt, &profileUpdated,
		&d.MatchCount, &d.ApplicationCount, &d.SentCount,
		&profile,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if submittedAt != nil && strings.TrimSpace(*submittedAt) != "" {
		d.ProfileSubmittedAt = submittedAt
	}
	d.ProfileUpdatedAt = profileUpdated
	if len(profile) > 0 {
		d.Profile = json.RawMessage(profile)
	}
	return &d, nil
}

type AdminMatchListItem struct {
	ID               int64                       `json:"id"`
	UserID           uuid.UUID                   `json:"userId"`
	UserEmail        string                      `json:"userEmail"`
	JobID            uuid.UUID                   `json:"jobId"`
	JobTitle         string                      `json:"jobTitle"`
	JobCompany       string                      `json:"jobCompany"`
	JobLocation      *string                     `json:"jobLocation,omitempty"`
	Score            *float32                    `json:"matchScore,omitempty"`
	MatchedChunks    *int                        `json:"matchedChunks,omitempty"`
	GatePassed       *bool                       `json:"gatePassed,omitempty"`
	Status           string                      `json:"status"`
	HasApplication   bool                        `json:"hasApplication"`
	ApplicationID    *uuid.UUID                  `json:"applicationId,omitempty"`
	ScoreBreakdown   *matching.ScoreBreakdown    `json:"scoreBreakdown,omitempty"`
	MatchReason      *ApplicationMatchReason     `json:"matchReason,omitempty"`
	Adjudication     *matching.AdjudicationResult `json:"adjudication,omitempty"`
	MatchTier        *string                     `json:"matchTier,omitempty"`
	MatchTierLabel   string                      `json:"matchTierLabel,omitempty"`
	CreatedAt        time.Time                   `json:"createdAt"`
}

type AdminMatchFilters struct {
	UserID    *uuid.UUID
	HasApp    *bool
	Status    string
	Search    string
}

func ListAdminMatches(ctx context.Context, pool *pgxpool.Pool, limit, offset int, f AdminMatchFilters) (AdminListResult[AdminMatchListItem], error) {
	where := []string{"1=1"}
	args := []any{}
	argN := 1

	if f.UserID != nil {
		where = append(where, fmt.Sprintf("jm.user_id = $%d", argN))
		args = append(args, *f.UserID)
		argN++
	}
	if f.Status != "" {
		where = append(where, fmt.Sprintf("jm.status = $%d", argN))
		args = append(args, f.Status)
		argN++
	}
	if f.HasApp != nil {
		if *f.HasApp {
			where = append(where, "ta.id IS NOT NULL")
		} else {
			where = append(where, "ta.id IS NULL")
		}
	}
	search := strings.TrimSpace(strings.ToLower(f.Search))
	if search != "" {
		where = append(where, fmt.Sprintf("(lower(dj.title) LIKE '%%' || $%d || '%%' OR lower(dj.company) LIKE '%%' || $%d || '%%' OR lower(u.email) LIKE '%%' || $%d || '%%')", argN, argN, argN))
		args = append(args, search)
		argN++
	}

	whereSQL := strings.Join(where, " AND ")

	countQ := fmt.Sprintf(`
		SELECT COUNT(*)::int
		FROM job_matches jm
		JOIN users u ON u.id = jm.user_id
		JOIN discovered_jobs dj ON dj.id = jm.job_id
		LEFT JOIN tailored_applications ta ON ta.match_id = jm.id
		WHERE %s`, whereSQL)
	var total int
	if err := pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return AdminListResult[AdminMatchListItem]{}, err
	}

	limitArg := argN
	offsetArg := argN + 1
	args = append(args, limit, offset)

	rows, err := pool.Query(ctx, fmt.Sprintf(`
		SELECT
			jm.id, jm.user_id, u.email, jm.job_id, dj.title, dj.company, dj.location,
			jm.score, jm.matched_chunks, jm.gate_passed, jm.status,
			ta.id IS NOT NULL, ta.id,
			jm.score_breakdown, jm.match_reason, jm.adjudication,
			jm.created_at
		FROM job_matches jm
		JOIN users u ON u.id = jm.user_id
		JOIN discovered_jobs dj ON dj.id = jm.job_id
		LEFT JOIN tailored_applications ta ON ta.match_id = jm.id
		WHERE %s
		ORDER BY jm.created_at DESC
		LIMIT $%d OFFSET $%d`, whereSQL, limitArg, offsetArg), args...)
	if err != nil {
		return AdminListResult[AdminMatchListItem]{}, err
	}
	defer rows.Close()

	items, err := scanAdminMatchRows(rows)
	if err != nil {
		return AdminListResult[AdminMatchListItem]{}, err
	}
	return AdminListResult[AdminMatchListItem]{Items: items, Total: total, Limit: limit, Offset: offset}, nil
}

func GetAdminMatchByID(ctx context.Context, pool *pgxpool.Pool, matchID int64) (*AdminMatchListItem, error) {
	row := pool.QueryRow(ctx, `
		SELECT
			jm.id, jm.user_id, u.email, jm.job_id, dj.title, dj.company, dj.location,
			jm.score, jm.matched_chunks, jm.gate_passed, jm.status,
			ta.id IS NOT NULL, ta.id,
			jm.score_breakdown, jm.match_reason, jm.adjudication,
			jm.created_at
		FROM job_matches jm
		JOIN users u ON u.id = jm.user_id
		JOIN discovered_jobs dj ON dj.id = jm.job_id
		LEFT JOIN tailored_applications ta ON ta.match_id = jm.id
		WHERE jm.id = $1`, matchID)

	items, err := scanAdminMatchRow(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return items, nil
}

func scanAdminMatchRows(rows pgx.Rows) ([]AdminMatchListItem, error) {
	var items []AdminMatchListItem
	for rows.Next() {
		item, err := scanAdminMatchFromScanner(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	if items == nil {
		items = []AdminMatchListItem{}
	}
	return items, rows.Err()
}

func scanAdminMatchRow(row pgx.Row) (*AdminMatchListItem, error) {
	return scanAdminMatchFromScanner(row)
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanAdminMatchFromScanner(row rowScanner) (*AdminMatchListItem, error) {
	var item AdminMatchListItem
	var score *float32
	var matchedChunks *int
	var gatePassed *bool
	var appID *uuid.UUID
	var scoreBreakdownRaw, matchReasonRaw, adjudicationRaw []byte

	err := row.Scan(
		&item.ID, &item.UserID, &item.UserEmail, &item.JobID,
		&item.JobTitle, &item.JobCompany, &item.JobLocation,
		&score, &matchedChunks, &gatePassed, &item.Status,
		&item.HasApplication, &appID,
		&scoreBreakdownRaw, &matchReasonRaw, &adjudicationRaw,
		&item.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	item.Score = score
	item.MatchedChunks = matchedChunks
	item.GatePassed = gatePassed
	item.ApplicationID = appID
	if len(scoreBreakdownRaw) > 0 {
		var bd matching.ScoreBreakdown
		if json.Unmarshal(scoreBreakdownRaw, &bd) == nil {
			item.ScoreBreakdown = &bd
		}
	}
	if len(matchReasonRaw) > 0 {
		var mr ApplicationMatchReason
		if json.Unmarshal(matchReasonRaw, &mr) == nil {
			item.MatchReason = &mr
		}
	}
	if len(adjudicationRaw) > 0 {
		var adj matching.AdjudicationResult
		if json.Unmarshal(adjudicationRaw, &adj) == nil {
			item.Adjudication = &adj
		}
	}
	item.MatchTier = matching.ClassifyMatchTier(score, item.ScoreBreakdown, item.Adjudication)
	if item.MatchTier != nil {
		item.MatchTierLabel = matching.MatchTierLabel(*item.MatchTier)
	}
	return &item, nil
}

type AdminApplicationListItem struct {
	TailoredApplication
	UserID    uuid.UUID `json:"userId"`
	UserEmail string    `json:"userEmail"`
}

type AdminApplicationFilters struct {
	UserID     *uuid.UUID
	Status     string
	MarkedSent *bool
	Search     string
}

func ListAdminApplications(ctx context.Context, pool *pgxpool.Pool, limit, offset int, f AdminApplicationFilters) (AdminListResult[AdminApplicationListItem], error) {
	where := []string{"1=1"}
	args := []any{}
	argN := 1

	if f.UserID != nil {
		where = append(where, fmt.Sprintf("ta.user_id = $%d", argN))
		args = append(args, *f.UserID)
		argN++
	}
	if f.Status != "" {
		where = append(where, fmt.Sprintf("ta.status = $%d", argN))
		args = append(args, f.Status)
		argN++
	}
	if f.MarkedSent != nil {
		where = append(where, fmt.Sprintf("ta.marked_sent = $%d", argN))
		args = append(args, *f.MarkedSent)
		argN++
	}
	search := strings.TrimSpace(strings.ToLower(f.Search))
	if search != "" {
		where = append(where, fmt.Sprintf("(lower(dj.title) LIKE '%%' || $%d || '%%' OR lower(dj.company) LIKE '%%' || $%d || '%%' OR lower(u.email) LIKE '%%' || $%d || '%%')", argN, argN, argN))
		args = append(args, search)
		argN++
	}

	whereSQL := strings.Join(where, " AND ")

	countQ := fmt.Sprintf(`
		SELECT COUNT(*)::int
		FROM tailored_applications ta
		JOIN users u ON u.id = ta.user_id
		JOIN discovered_jobs dj ON dj.id = ta.job_id
		WHERE %s`, whereSQL)
	var total int
	if err := pool.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return AdminListResult[AdminApplicationListItem]{}, err
	}

	limitArg := argN
	offsetArg := argN + 1
	args = append(args, limit, offset)

	rows, err := pool.Query(ctx, fmt.Sprintf(`
		SELECT ta.user_id, u.email,
		       ta.id, ta.job_id, ta.match_id, dj.title, dj.company, dj.location, dj.apply_url,
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
		JOIN users u ON u.id = ta.user_id
		JOIN discovered_jobs dj ON dj.id = ta.job_id
		LEFT JOIN job_matches jm ON jm.id = ta.match_id
		WHERE %s
		ORDER BY ta.created_at DESC
		LIMIT $%d OFFSET $%d`, whereSQL, limitArg, offsetArg), args...)
	if err != nil {
		return AdminListResult[AdminApplicationListItem]{}, err
	}
	defer rows.Close()

	var items []AdminApplicationListItem
	for rows.Next() {
		var item AdminApplicationListItem
		var formAnswers []byte
		var jobFormFields []byte
		var score *float32
		var matchedChunks *int
		var gatePassed *bool
		var scoreBreakdownRaw, matchReasonRaw, adjudicationRaw []byte

		err := rows.Scan(
			&item.UserID, &item.UserEmail,
			&item.ID, &item.JobID, &item.MatchID,
			&item.Title, &item.Company, &item.Location, &item.ApplyURL,
			&item.TailoredResume, &item.TailoredCoverLetter, &item.ResumePdfURL, &item.ResumeFilename,
			&item.CoverLetterPdfURL, &item.CoverLetterFilename, &formAnswers,
			&jobFormFields,
			&item.Status, &item.MarkedSent, &item.SentAt, &item.CreatedAt,
			&score, &matchedChunks, &gatePassed, &scoreBreakdownRaw, &matchReasonRaw, &adjudicationRaw,
		)
		if err != nil {
			return AdminListResult[AdminApplicationListItem]{}, err
		}
		item.FormAnswers = rawOrEmptyJSONArray(formAnswers)
		item.JobFormFields = DedupeJobFormFieldsJSON(rawOrEmptyJSONArray(jobFormFields))
		item.MatchScore = score
		item.MatchedChunks = matchedChunks
		item.GatePassed = gatePassed
		unmarshalMatchMeta(&item.TailoredApplication, scoreBreakdownRaw, matchReasonRaw, adjudicationRaw)
		items = append(items, item)
	}
	if items == nil {
		items = []AdminApplicationListItem{}
	}
	return AdminListResult[AdminApplicationListItem]{Items: items, Total: total, Limit: limit, Offset: offset}, rows.Err()
}

func GetAdminApplicationByID(ctx context.Context, pool *pgxpool.Pool, appID uuid.UUID) (*AdminApplicationListItem, error) {
	row := pool.QueryRow(ctx, `
		SELECT ta.user_id, u.email,
		       ta.id, ta.job_id, ta.match_id, dj.title, dj.company, dj.location, dj.apply_url,
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
		JOIN users u ON u.id = ta.user_id
		JOIN discovered_jobs dj ON dj.id = ta.job_id
		LEFT JOIN job_matches jm ON jm.id = ta.match_id
		WHERE ta.id = $1`, appID)

	var item AdminApplicationListItem
	var formAnswers []byte
	var jobFormFields []byte
	var score *float32
	var matchedChunks *int
	var gatePassed *bool
	var scoreBreakdownRaw, matchReasonRaw, adjudicationRaw []byte

	err := row.Scan(
		&item.UserID, &item.UserEmail,
		&item.ID, &item.JobID, &item.MatchID,
		&item.Title, &item.Company, &item.Location, &item.ApplyURL,
		&item.TailoredResume, &item.TailoredCoverLetter, &item.ResumePdfURL, &item.ResumeFilename,
		&item.CoverLetterPdfURL, &item.CoverLetterFilename, &formAnswers,
		&jobFormFields,
		&item.Status, &item.MarkedSent, &item.SentAt, &item.CreatedAt,
		&score, &matchedChunks, &gatePassed, &scoreBreakdownRaw, &matchReasonRaw, &adjudicationRaw,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	item.FormAnswers = rawOrEmptyJSONArray(formAnswers)
	item.JobFormFields = DedupeJobFormFieldsJSON(rawOrEmptyJSONArray(jobFormFields))
	item.MatchScore = score
	item.MatchedChunks = matchedChunks
	item.GatePassed = gatePassed
	unmarshalMatchMeta(&item.TailoredApplication, scoreBreakdownRaw, matchReasonRaw, adjudicationRaw)
	return &item, nil
}

func rawOrEmptyJSONArray(b []byte) json.RawMessage {
	if len(b) > 0 {
		return json.RawMessage(b)
	}
	return json.RawMessage("[]")
}

func unmarshalMatchMeta(a *TailoredApplication, scoreBreakdownRaw, matchReasonRaw, adjudicationRaw []byte) {
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
	a.MatchTier = matching.ClassifyMatchTier(a.MatchScore, a.ScoreBreakdown, a.Adjudication)
	if a.MatchTier != nil {
		a.MatchTierLabel = matching.MatchTierLabel(*a.MatchTier)
	}
}

type AdminJobRunItem struct {
	ID             int64           `json:"id"`
	JobType        string          `json:"jobType"`
	Status         string          `json:"status"`
	Attempts       int             `json:"attempts"`
	LastError      *string         `json:"lastError,omitempty"`
	CreatedAt      time.Time       `json:"createdAt"`
	UpdatedAt      time.Time       `json:"updatedAt"`
	CompletedAt    *time.Time      `json:"completedAt,omitempty"`
	IdempotencyKey string          `json:"idempotencyKey"`
	Payload        json.RawMessage `json:"payload,omitempty"`
}

func ListAdminJobRuns(ctx context.Context, pool *pgxpool.Pool, limit, offset int, status string) (AdminListResult[AdminJobRunItem], error) {
	status = strings.TrimSpace(status)
	var total int
	if status == "" {
		if err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM job_runs`).Scan(&total); err != nil {
			return AdminListResult[AdminJobRunItem]{}, err
		}
	} else {
		if err := pool.QueryRow(ctx, `SELECT COUNT(*)::int FROM job_runs WHERE status = $1`, status).Scan(&total); err != nil {
			return AdminListResult[AdminJobRunItem]{}, err
		}
	}

	var rows pgx.Rows
	var err error
	if status == "" {
		rows, err = pool.Query(ctx, `
			SELECT id, job_type, status, attempts, last_error, created_at, updated_at, completed_at, idempotency_key, payload
			FROM job_runs
			ORDER BY created_at DESC
			LIMIT $1 OFFSET $2`, limit, offset)
	} else {
		rows, err = pool.Query(ctx, `
			SELECT id, job_type, status, attempts, last_error, created_at, updated_at, completed_at, idempotency_key, payload
			FROM job_runs
			WHERE status = $1
			ORDER BY created_at DESC
			LIMIT $2 OFFSET $3`, status, limit, offset)
	}
	if err != nil {
		return AdminListResult[AdminJobRunItem]{}, err
	}
	defer rows.Close()

	var items []AdminJobRunItem
	for rows.Next() {
		var item AdminJobRunItem
		var payload []byte
		if err := rows.Scan(
			&item.ID, &item.JobType, &item.Status, &item.Attempts, &item.LastError,
			&item.CreatedAt, &item.UpdatedAt, &item.CompletedAt, &item.IdempotencyKey, &payload,
		); err != nil {
			return AdminListResult[AdminJobRunItem]{}, err
		}
		if len(payload) > 0 {
			item.Payload = json.RawMessage(payload)
		} else {
			item.Payload = json.RawMessage("{}")
		}
		items = append(items, item)
	}
	if items == nil {
		items = []AdminJobRunItem{}
	}
	return AdminListResult[AdminJobRunItem]{Items: items, Total: total, Limit: limit, Offset: offset}, rows.Err()
}
