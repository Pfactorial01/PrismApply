package tailoring

import (
	"context"
	"encoding/json"
	"strings"

	"prismapply/api/internal/config"
)

var coverSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"cover_letter": map[string]any{"type": "string"},
		"cited_fields": arrayOfStrings(),
	},
	"required":             []string{"cover_letter", "cited_fields"},
	"additionalProperties": false,
}

const coverSystemPrompt = `Write a concise cover letter (not a second resume). Structure:
1. Opening: role + company + one specific hook from the JD or companies the applicant admires
2. Paragraph 2: strongest JD-aligned win with a metric from profile evidence
3. Paragraph 3: second proof point or stack fit
4. Close: enthusiasm; mention logistics only if profile supports (remote/relocation)

Rules:
- Ground every claim in the evidence map and profile. No invented facts.
- Do not include numeric metrics (percentages, multipliers, dollar amounts) unless they appear verbatim in the evidence excerpts or profile impactMetrics fields.
- Ban generic filler unless profile uses similar language.
- 250-400 words. Professional tone matching applicant voice where possible.
- Start with the salutation (e.g. "Dear Hiring Manager,"). Do not include a letterhead, applicant address block, date line, or [Date] placeholder.
- End with a closing (e.g. "Sincerely,") followed by the applicant's full name from profile evidence. Never use placeholders like [Your Name].`

func WriteCoverLetter(ctx context.Context, cfg config.Config, jobTitle, jobCompany string, jd JdRequirements, evidence EvidenceMap) (CoverLetterResult, error) {
	var topItems []EvidenceItem
	for _, item := range evidence.Items {
		if len(item.Evidence) > 0 {
			topItems = append(topItems, item)
		}
		if len(topItems) >= 10 {
			break
		}
	}
	topJSON, _ := json.MarshalIndent(topItems, "", "  ")

	expContent := ""
	for _, s := range evidence.ProfileSections {
		if s.Key == "experience" {
			expContent = s.Content
			if len(expContent) > 500 {
				expContent = expContent[:500]
			}
			break
		}
	}

	user := "## Role\n" + jobTitle + " at " + jobCompany + "\n\n## JD themes\nMust-haves: " +
		strings.Join(jd.MustHaveSkills, ", ") + "\nThemes: " + strings.Join(jd.ResponsibilityThemes, ", ") +
		"\n\n## Top evidence\n" + string(topJSON) +
		"\n\n## Motivations / admire\ncompaniesYouAdmire: " + evidence.Identity["companiesYouAdmire"] +
		"\nwhatYouWantNextNote: " + expContent

	var parsed struct {
		CoverLetter string   `json:"cover_letter"`
		CitedFields []string `json:"cited_fields"`
	}
	if err := CallJSONLLM(ctx, cfg, coverSystemPrompt, user, "cover_letter", coverSchema, 0.35, &parsed); err != nil {
		return CoverLetterResult{}, err
	}
	fullName := strings.TrimSpace(evidence.Identity["fullName"])
	return CoverLetterResult{
		CoverLetter: sanitizeCoverLetter(parsed.CoverLetter, fullName),
		CitedFields: parsed.CitedFields,
	}, nil
}

func sanitizeCoverLetter(s, fullName string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	// Prefer body starting at salutation when model adds letterhead anyway.
	lower := strings.ToLower(s)
	if idx := strings.Index(lower, "dear "); idx > 0 {
		s = strings.TrimSpace(s[idx:])
	}
	var lines []string
	for _, line := range strings.Split(s, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || trimmed == "[Date]" || strings.EqualFold(trimmed, "date:") {
			continue
		}
		lines = append(lines, line)
	}
	return replaceCoverLetterPlaceholders(strings.TrimSpace(strings.Join(lines, "\n")), fullName)
}

func replaceCoverLetterPlaceholders(s, fullName string) string {
	if fullName == "" {
		return s
	}
	for _, ph := range []string{"[Your Name]", "[your name]", "[YOUR NAME]", "[Name]", "[Applicant Name]"} {
		s = strings.ReplaceAll(s, ph, fullName)
	}
	trimmed := strings.TrimSpace(s)
	if strings.HasSuffix(trimmed, "Sincerely,") || strings.HasSuffix(trimmed, "Sincerely") {
		return trimmed + "\n" + fullName
	}
	return s
}
