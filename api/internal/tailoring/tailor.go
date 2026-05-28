package tailoring

import (
	"bytes"
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"prismapply/api/internal/config"
	"prismapply/api/internal/matching"
	"prismapply/api/internal/r2"
)

// RunPipeline executes JD → evidence → resume → cover → forms.
func RunPipeline(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, tailorCtx TailorContext) (PipelineResult, error) {
	slog.Info("tailor_pipeline_start", "job_id", tailorCtx.JobID, "match_id", tailorCtx.MatchID)

	jd, err := getJdRequirements(ctx, pool, tailorCtx.JobID)
	if err != nil {
		return PipelineResult{}, err
	}
	if jd == nil {
		extracted, err := ExtractJdRequirements(ctx, cfg, tailorCtx.JobTitle, tailorCtx.JobCompany,
			tailorCtx.JobLocation, tailorCtx.JobDescription, tailorCtx.JobFacts)
		if err != nil {
			return PipelineResult{}, err
		}
		jd = &extracted
		if err := upsertJdRequirements(ctx, pool, tailorCtx.JobID, *jd); err != nil {
			return PipelineResult{}, err
		}
	}

	embeddingSections, err := getProfileEmbeddingSections(ctx, pool, tailorCtx.UserID, tailorCtx.JobID, 15)
	if err != nil {
		return PipelineResult{}, err
	}
	evidence := BuildEvidenceMap(tailorCtx.ProfileJSON, *jd, embeddingSections)

	structuredResume, err := WriteStructuredResume(ctx, cfg, tailorCtx.JobTitle, tailorCtx.JobCompany, *jd, evidence)
	if err != nil {
		return PipelineResult{}, err
	}
	validation := ValidateStructuredResume(structuredResume, evidence.DensityHints.ResumeLayout)
	if !validation.OK {
		slog.Warn("tailor_resume_validation_retry", "warnings", validation.Warnings)
		structuredResume, err = WriteStructuredResume(ctx, cfg, tailorCtx.JobTitle, tailorCtx.JobCompany, *jd, evidence, validation.Warnings)
		if err != nil {
			return PipelineResult{}, err
		}
		validation = ValidateStructuredResume(structuredResume, evidence.DensityHints.ResumeLayout)
	}

	templateID := pickTemplateID(tailorCtx.UserID, tailorCtx.JobID)
	meta := TailorMetadata{
		CitedFields:        validation.CitedFields,
		TemplateID:         templateID,
		ValidationWarnings: validation.Warnings,
	}

	cover, err := WriteCoverLetter(ctx, cfg, tailorCtx.JobTitle, tailorCtx.JobCompany, *jd, evidence)
	if err != nil {
		return PipelineResult{}, err
	}
	mergeMetadataCitations(&meta, cover.CitedFields)

	fullName := profileStr(tailorCtx.ProfileJSON, "fullName")
	if fullName == "" {
		fullName = structuredResume.Name
	}
	if fullName == "" {
		fullName = "Applicant"
	}
	cover.CoverLetter = sanitizeCoverLetter(cover.CoverLetter, fullName)

	classified := ClassifyFormFields(tailorCtx.FormFields)
	formAnswers, formLint, err := AnswerFormFields(ctx, cfg, classified, tailorCtx.ProfileJSON, evidence, *jd, tailorCtx.JobCompany, cover.CoverLetter)
	if err != nil {
		return PipelineResult{}, err
	}
	if len(formLint) > 0 {
		meta.ValidationWarnings = append(meta.ValidationWarnings, lintMessages(formLint)...)
		slog.Warn("form_answer_lint", "match_id", tailorCtx.MatchID, "issues", len(formLint))
	}

	for _, a := range formAnswers {
		for _, ref := range a.SourceRefs {
			if ref.Field != "" {
				meta.CitedFields = append(meta.CitedFields, ref.Field)
			}
		}
		if a.LowConfidence && strings.TrimSpace(a.Value) != "" {
			meta.LowConfidenceFields = append(meta.LowConfidenceFields, a.Label)
		}
	}
	meta.CitedFields = uniqueStrings(meta.CitedFields)

	return PipelineResult{
		StructuredResume: structuredResume,
		PlainTextResume:  structuredResumeToPlainText(structuredResume),
		CoverLetter:      cover.CoverLetter,
		FormAnswers:      formAnswers,
		TemplateID:       templateID,
		ResumeFilename:   buildResumeFilename(fullName, tailorCtx.JobCompany, tailorCtx.JobTitle),
		Metadata:         meta,
	}, nil
}

// TailorMatch generates and stores a tailored application package for a match ID.
func TailorMatch(ctx context.Context, cfg config.Config, pool *pgxpool.Pool, r2Client *r2.Client, matchID int64) error {
	input, err := fetchTailorInput(ctx, pool, matchID)
	if err != nil {
		return err
	}
	if input == nil || len(input.ProfileJSON) == 0 {
		return fmt.Errorf("match %d: profile not found", matchID)
	}

	prefs, err := loadUserPreferences(ctx, pool, input.UserID)
	if err != nil {
		return err
	}
	jobFacts := resolveJobFacts(input)

	gate := matching.MatchEligible(prefs, jobFacts)
	if !gate.OK {
		return fmt.Errorf("match %d: job violates user preferences (%s)", matchID, strings.Join(gate.Reasons, "; "))
	}

	tailorCtx := TailorContext{
		MatchID:           matchID,
		UserID:            input.UserID.String(),
		JobID:             input.JobID.String(),
		JobTitle:          input.JobTitle,
		JobCompany:        input.JobCompany,
		JobLocation:       derefStr(input.JobLocation),
		JobDescription:    derefStr(input.JobDescription),
		JobSeniorityLevel: derefStr(input.JobSeniorityLevel),
		JobFacts:          jobFacts,
		FormFields:        input.FormFields,
		ProfileJSON:       input.ProfileJSON,
		Prefs:             prefs,
	}

	result, err := RunPipeline(ctx, cfg, pool, tailorCtx)
	if err != nil {
		return err
	}

	pdfBytes, err := RenderStructuredResumePDF(cfg, result.StructuredResume, result.TemplateID)
	if err != nil {
		return err
	}

	pdfURL, err := uploadResumePDF(r2Client, input.UserID.String(), matchID, result.ResumeFilename, pdfBytes)
	if err != nil {
		return err
	}

	classified := ClassifyFormFields(input.FormFields)
	coverLetterPDFURL := ""
	needsCoverLetterPDF := false
	for _, cf := range classified {
		if cf.FieldClass == FieldCoverLetter {
			needsCoverLetterPDF = true
			break
		}
	}
	if needsCoverLetterPDF && strings.TrimSpace(result.CoverLetter) != "" {
		coverFilename := buildCoverLetterFilename(fullNameFromResult(result, input), input.JobCompany, input.JobTitle)
		coverPDF, err := RenderCoverLetterPDF(cfg, result.CoverLetter)
		if err != nil {
			return err
		}
		coverLetterPDFURL, err = uploadCoverLetterPDF(r2Client, input.UserID.String(), coverFilename, coverPDF)
		if err != nil {
			return err
		}
		result.CoverLetterFilename = coverFilename
		result.CoverLetterPDFURL = coverLetterPDFURL
	}

	formAnswers := FinalizeFormAnswers(result.FormAnswers, classified, pdfURL, result.CoverLetter, coverLetterPDFURL)
	return insertTailoredApplication(ctx, pool, matchID, input.UserID, input.JobID, result, formAnswers, pdfURL)
}

func fullNameFromResult(result PipelineResult, input *tailorInput) string {
	if input != nil {
		if n := profileStr(input.ProfileJSON, "fullName"); n != "" {
			return n
		}
	}
	if result.StructuredResume.Name != "" {
		return result.StructuredResume.Name
	}
	return "Applicant"
}

func uploadCoverLetterPDF(client *r2.Client, userID, filename string, pdf []byte) (string, error) {
	if strings.TrimSpace(filename) == "" {
		filename = "Cover_Letter.pdf"
	}
	if !client.Enabled() {
		return fmt.Sprintf("s3://local/cover-letters/%s/%s", userID, filename), nil
	}
	key := fmt.Sprintf("cover-letters/%s/%s", userID, filename)
	if err := client.Upload(key, bytes.NewReader(pdf), "application/pdf"); err != nil {
		return "", err
	}
	if url := client.PublicURL(key); url != "" {
		return url, nil
	}
	return "s3://" + key, nil
}

func resolveJobFacts(input *tailorInput) matching.JobFacts {
	loc, desc := "", ""
	if input.JobLocation != nil {
		loc = *input.JobLocation
	}
	if input.JobDescription != nil {
		desc = *input.JobDescription
	}
	labels := make([]string, len(input.FormFields))
	for i, f := range input.FormFields {
		labels[i] = f.Label
	}
	extracted := matching.ExtractJobFacts(input.JobTitle, input.JobCompany, loc, desc, labels)
	if len(input.JobFactsJSON) > 0 {
		stored, err := matching.JobFactsFromJSON(input.JobFactsJSON)
		if err == nil {
			extracted.RemotePolicy = orDefault(stored.RemotePolicy, extracted.RemotePolicy)
			extracted.EmploymentType = orDefault(stored.EmploymentType, extracted.EmploymentType)
			if input.JobSeniorityLevel != nil && *input.JobSeniorityLevel != "" {
				extracted.SeniorityLevel = *input.JobSeniorityLevel
			} else if stored.SeniorityLevel != "" {
				extracted.SeniorityLevel = stored.SeniorityLevel
			}
			if len(stored.IndustryTags) > 0 {
				extracted.IndustryTags = stored.IndustryTags
			}
			if stored.RequiresSponsorship != nil {
				extracted.RequiresSponsorship = stored.RequiresSponsorship
			}
			extracted.HasHeavyOncall = stored.HasHeavyOncall
		}
	} else if input.JobSeniorityLevel != nil && *input.JobSeniorityLevel != "" {
		extracted.SeniorityLevel = *input.JobSeniorityLevel
	}
	return extracted
}

func uploadResumePDF(client *r2.Client, userID string, matchID int64, filename string, pdf []byte) (string, error) {
	if strings.TrimSpace(filename) == "" {
		filename = fmt.Sprintf("%d.pdf", matchID)
	}
	if !client.Enabled() {
		return fmt.Sprintf("s3://local/resumes/%s/%s", userID, filename), nil
	}
	key := fmt.Sprintf("resumes/%s/%s", userID, filename)
	if err := client.Upload(key, bytes.NewReader(pdf), "application/pdf"); err != nil {
		return "", err
	}
	if url := client.PublicURL(key); url != "" {
		return url, nil
	}
	return "s3://" + key, nil
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func uniqueStrings(in []string) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, s := range in {
		if s == "" {
			continue
		}
		if _, ok := seen[s]; ok {
			continue
		}
		seen[s] = struct{}{}
		out = append(out, s)
	}
	return out
}
