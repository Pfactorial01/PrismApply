package tailoring

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"prismapply/api/internal/config"
	"prismapply/api/internal/matching"
)

var batchFormSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"answers": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"position":      map[string]any{"type": "number"},
					"label":         map[string]any{"type": "string"},
					"value":         map[string]any{"type": "string"},
					"source_field":  map[string]any{"type": "string"},
				},
				"required":             []string{"position", "label", "value", "source_field"},
				"additionalProperties": false,
			},
		},
	},
	"required":             []string{"answers"},
	"additionalProperties": false,
}

var behavioralSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"value":          map[string]any{"type": "string"},
		"source_fields": arrayOfStrings(),
		"low_confidence": map[string]any{"type": "boolean"},
	},
	"required":             []string{"value", "source_fields", "low_confidence"},
	"additionalProperties": false,
}

func matchLabel(label string, patterns []*regexp.Regexp) bool {
	return matchAny(label, patterns)
}

func resolveIdentityAnswer(field ClassifiedField, identity map[string]string, profile map[string]any) string {
	label := strings.ToLower(field.Label)
	if matchLabel(label, []*regexp.Regexp{regexp.MustCompile(`(?i)\bfirst name\b`)}) {
		full := orDefault(identity["fullName"], profileStr(profile, "fullName"))
		parts := strings.Fields(full)
		if len(parts) > 0 {
			return parts[0]
		}
		return full
	}
	if matchLabel(label, []*regexp.Regexp{regexp.MustCompile(`(?i)\blast name\b`)}) {
		full := orDefault(identity["fullName"], profileStr(profile, "fullName"))
		parts := strings.Fields(full)
		if len(parts) > 1 {
			return strings.Join(parts[1:], " ")
		}
		return ""
	}
	if matchLabel(label, []*regexp.Regexp{regexp.MustCompile(`(?i)\bfull name\b`), regexp.MustCompile(`(?i)^name$`)}) {
		return orDefault(identity["fullName"], profileStr(profile, "fullName"))
	}
	if matchLabel(label, []*regexp.Regexp{regexp.MustCompile(`(?i)\bemail\b`)}) {
		return orDefault(profileStr(profile, "email"), identity["email"])
	}
	if matchLabel(label, []*regexp.Regexp{regexp.MustCompile(`(?i)\bphone\b`), regexp.MustCompile(`(?i)\bmobile\b`)}) {
		return orDefault(identity["phoneNumber"], profileStr(profile, "phoneNumber"))
	}
	if matchLabel(label, []*regexp.Regexp{regexp.MustCompile(`(?i)\blinkedin\b`)}) {
		return orDefault(identity["linkedInUrl"], profileStr(profile, "linkedInUrl"))
	}
	if isGitHubLinkQuestion(field.Label) {
		return orDefault(identity["githubUrl"], profileStr(profile, "githubUrl"))
	}
	if matchLabel(label, []*regexp.Regexp{regexp.MustCompile(`(?i)\bportfolio\b`), regexp.MustCompile(`(?i)\bwebsite\b`)}) {
		if u := orDefault(identity["portfolioUrl"], profileStr(profile, "portfolioUrl")); u != "" {
			return u
		}
		return orDefault(identity["githubUrl"], profileStr(profile, "githubUrl"))
	}
	if matchLabel(label, []*regexp.Regexp{regexp.MustCompile(`(?i)\bcurrent company\b`)}) {
		return profileStr(profile, "currentCompany")
	}
	return ""
}

func formatLocationAnswer(city, region string) string {
	city = strings.TrimSpace(city)
	region = strings.TrimSpace(region)
	regionLabel := matching.LabelForSlug(region)
	if regionLabel == region && region != "" {
		// unknown slug — title-case lightly
		regionLabel = strings.ReplaceAll(region, "_", " ")
	}
	parts := filterNonEmpty([]string{city, regionLabel})
	return strings.Join(parts, ", ")
}

func resolveExportControlsAnswer(field ClassifiedField, profile map[string]any) string {
	if !strings.Contains(strings.ToLower(field.Label), "export control") {
		return ""
	}
	if len(field.Options) == 0 {
		return ""
	}
	visa := profileStr(profile, "visaStatus")
	switch visa {
	case "citizen_pr":
		return pickOption(field.Options, "United States citizen or national")
	case "need_sponsorship":
		return pickOption(field.Options, "None of the above")
	default:
		return pickOption(field.Options, "United States citizen or national")
	}
}

func pickOption(options []string, contains string) string {
	lower := strings.ToLower(contains)
	for _, opt := range options {
		if strings.Contains(strings.ToLower(opt), lower) {
			return opt
		}
	}
	return ""
}

func resolveComplianceSelect(field ClassifiedField, profile map[string]any) (string, bool) {
	label := strings.ToLower(field.Label)
	visa := profileStr(profile, "visaStatus")
	needsSponsor := boolPref(profile, "needsVisaSponsorship") || visa == "need_sponsorship"

	if strings.Contains(label, "export control") {
		if v := resolveExportControlsAnswer(field, profile); v != "" {
			return v, false
		}
	}
	if strings.Contains(label, "clearance eligibility") && len(field.Options) > 0 {
		if v := pickOption(field.Options, "eligible for a U.S. security clearance"); v != "" {
			return v, false
		}
	}
	if strings.Contains(label, "clearance level") && len(field.Options) > 0 {
		if v := pickOption(field.Options, "never held"); v != "" {
			return v, false
		}
	}
	if strings.Contains(label, "sponsorship") && len(field.Options) > 0 {
		if needsSponsor {
			return pickOption(field.Options, "Yes"), false
		}
		return pickOption(field.Options, "No"), false
	}
	if (strings.Contains(label, "work authorization") || strings.Contains(label, "authorized to work")) && len(field.Options) > 0 {
		if v, ok := inferWorkAuthSelect(field, profile); ok {
			return v, false
		}
	}
	if strings.Contains(label, "onsite") && strings.Contains(label, "office") && len(field.Options) > 0 {
		wa := profileStr(profile, "workArrangement")
		if wa == "onsite" || wa == "flexible" || boolPref(profile, "openToRelocate") {
			return pickOption(field.Options, "Yes"), false
		}
	}
	return "", true
}

func resolveLocationAnswer(field ClassifiedField, identity map[string]string, profile map[string]any) string {
	label := strings.ToLower(field.Label)
	if matchLabel(label, []*regexp.Regexp{
		regexp.MustCompile(`(?i)\bauthorized\b`),
		regexp.MustCompile(`(?i)\bwork authorization\b`),
		regexp.MustCompile(`(?i)\blegal.*work\b`),
	}) {
		visa := orDefault(identity["visaStatus"], profileStr(profile, "visaStatus"))
		if visa != "" {
			return visa
		}
		if v, ok := profile["needsVisaSponsorship"].(bool); ok && v {
			return "Requires visa sponsorship"
		}
		return "Authorized to work"
	}
	if matchLabel(label, []*regexp.Regexp{regexp.MustCompile(`(?i)\bremote\b`)}) {
		return orDefault(identity["workArrangement"], profileStr(profile, "workArrangement"))
	}
	return formatLocationWithCountry(
		profileStr(profile, "cityOrDetail"),
		orDefault(identity["region"], profileStr(profile, "region")),
		orDefault(profileStr(profile, "country"), identity["country"]),
	)
}

func resolveSelectAnswer(field ClassifiedField, identity map[string]string, profile map[string]any) (string, bool) {
	if val, low := resolveComplianceSelect(field, profile); val != "" && !low {
		return val, false
	}
	if val, low := resolveInferableSelect(field, profile); val != "" && !low {
		return val, false
	}
	raw := resolveIdentityAnswer(field, identity, profile)
	if raw == "" {
		return "", true
	}
	if len(field.Options) == 0 {
		return raw, false
	}
	lower := strings.ToLower(raw)
	for _, opt := range field.Options {
		ol := strings.ToLower(opt)
		if ol == lower {
			return opt, false
		}
		if lower != "" && strings.Contains(ol, lower) {
			return opt, false
		}
		if lower != "" && strings.Contains(lower, ol) {
			return opt, false
		}
	}
	return raw, true
}

func answerBatchFields(ctx context.Context, cfg config.Config, fields []ClassifiedField, profile map[string]any, identity map[string]string, jd JdRequirements) ([]FormFieldAnswer, error) {
	var deterministic []FormFieldAnswer
	var needsLLM []ClassifiedField

	for _, f := range fields {
		switch f.FieldClass {
		case FieldEEO:
			deterministic = append(deterministic, FormFieldAnswer{Label: f.Label, Value: ""})
		case FieldIdentity:
			val := resolveIdentityAnswer(f, identity, profile)
			deterministic = append(deterministic, FormFieldAnswer{Label: f.Label, Value: val, LowConfidence: f.Required && val == ""})
		case FieldLocation:
			val := resolveLocationAnswer(f, identity, profile)
			deterministic = append(deterministic, FormFieldAnswer{Label: f.Label, Value: val, LowConfidence: f.Required && val == ""})
		case FieldSelect:
			val, low := resolveComplianceSelect(f, profile)
			if val != "" && !low {
				deterministic = append(deterministic, FormFieldAnswer{Label: f.Label, Value: val})
				continue
			}
			val, low = resolveInferableSelect(f, profile)
			if val != "" && !low {
				deterministic = append(deterministic, FormFieldAnswer{Label: f.Label, Value: normalizeSelectValue(val, f.Options)})
				continue
			}
			val, low = resolveSelectAnswer(f, identity, profile)
			if val != "" && !low {
				deterministic = append(deterministic, FormFieldAnswer{Label: f.Label, Value: val})
			} else {
				needsLLM = append(needsLLM, f)
			}
		case FieldShortText:
			val := resolveIdentityAnswer(f, identity, profile)
			if val == "" && matchAny(strings.ToLower(f.Label), locationPatterns) {
				val = resolveLocationAnswer(f, identity, profile)
			}
			if val != "" {
				deterministic = append(deterministic, FormFieldAnswer{Label: f.Label, Value: val})
				continue
			}
			needsLLM = append(needsLLM, f)
		default:
			needsLLM = append(needsLLM, f)
		}
	}

	if len(needsLLM) == 0 {
		return deterministic, nil
	}

	system := `Fill application form fields from profile data only. Never invent facts.
For every field you must return an answer. Use empty string only if truly unknown.
For yes/no or select fields with Yes/No options, answer strictly "Yes" or "No" based on profile.
For select fields with options, output EXACT option text from the options list when possible.
Infer years-of-experience, English level, compensation, notice period, and region from structured context when explicit profile fields exist.
Do not claim US/Canada work authorization unless workAuthorizedInUS/workAuthorizedInCanada is true.`

	var fieldsDesc strings.Builder
	for i, f := range needsLLM {
		line := fmt.Sprintf("%d. position=%d label=%q type=%s required=%t", i+1, f.Position+1, f.Label, f.FieldType, f.Required)
		if len(f.Options) > 0 {
			optJSON, _ := json.Marshal(f.Options)
			line += " options=" + string(optJSON)
		}
		fieldsDesc.WriteString(line)
		fieldsDesc.WriteString("\n")
	}

	role := ""
	if len(jd.RoleTitleVariants) > 0 {
		role = jd.RoleTitleVariants[0]
	}
	themes := jd.ResponsibilityThemes
	if len(themes) > 3 {
		themes = themes[:3]
	}
	idJSON, _ := json.MarshalIndent(identity, "", "  ")
	profJSON, _ := json.Marshal(profile)
	if len(profJSON) > 6000 {
		profJSON = profJSON[:6000]
	}

	user := fmt.Sprintf("JD context: %s — themes: %s\n\nFields:\n%s\nProfile identity:\n%s\n\nProfile preferences: openToContract=%t openToRelocate=%t needsVisaSponsorship=%t\n%s\n\nProfile excerpt:\n%s",
		role, strings.Join(themes, ", "), fieldsDesc.String(), string(idJSON),
		boolPref(profile, "openToContract"), boolPref(profile, "openToRelocate"), boolPref(profile, "needsVisaSponsorship"),
		batchFormUserSuffix(profile),
		string(profJSON))

	var parsed struct {
		Answers []struct {
			Position    int    `json:"position"`
			Label       string `json:"label"`
			Value       string `json:"value"`
			SourceField string `json:"source_field"`
		} `json:"answers"`
	}
	if err := CallJSONLLM(ctx, cfg, system, user, "batch_form_answers", batchFormSchema, 0.25, &parsed); err != nil {
		return nil, err
	}

	var rows []batchAnswerRow
	for _, a := range parsed.Answers {
		rows = append(rows, batchAnswerRow{
			Position: a.Position, Label: a.Label, Value: a.Value, SourceField: a.SourceField,
		})
	}
	deterministic = append(deterministic, mergeBatchAnswers(needsLLM, profile, rows)...)
	return deterministic, nil
}

func answerBehavioralField(ctx context.Context, cfg config.Config, field ClassifiedField, profile map[string]any, evidence EvidenceMap, jd JdRequirements, jobCompany string) (FormFieldAnswer, error) {
	primaryStory, storyKey := primaryBehavioralStory(profile, field.Label)
	system := `Answer one behavioral or long-form application question. Ground in the primary profile story when provided.
Max 2000 chars. Use applicant voice. No invented facts or metrics. If insufficient profile data, write a brief honest answer — do not fabricate.`

	items := evidence.Items
	if len(items) > 8 {
		items = items[:8]
	}
	itemsJSON, _ := json.MarshalIndent(items, "", "  ")

	var stories strings.Builder
	for _, s := range evidence.ProfileSections {
		if strings.HasPrefix(s.Key, "stories") {
			stories.WriteString(s.Content)
			stories.WriteString("\n\n")
		}
	}

	primaryBlock := ""
	if primaryStory != "" {
		primaryBlock = fmt.Sprintf("\nPrimary story to use (from profile field %s):\n%s\n", storyKey, primaryStory)
	}

	githubBlock := ""
	if isGitHubDescribeQuestion(field.Label) {
		githubBlock = githubProjectContext(profile)
	}

	user := fmt.Sprintf(`Company: %s
Field: "%s" (required=%t)
JD themes: %s
%s%s
Relevant evidence:
%s

Other stories (use only if needed):
%s`, jobCompany, field.Label, field.Required, strings.Join(jd.ResponsibilityThemes, ", "), primaryBlock, githubBlock, string(itemsJSON), stories.String())

	var parsed struct {
		Value          string   `json:"value"`
		SourceFields   []string `json:"source_fields"`
		LowConfidence  bool     `json:"low_confidence"`
	}
	if err := CallJSONLLM(ctx, cfg, system, user, "behavioral_answer", behavioralSchema, 0.35, &parsed); err != nil {
		return FormFieldAnswer{}, err
	}

	var refs []SourceRef
	if storyKey != "" {
		refs = append(refs, SourceRef{Field: storyKey})
	}
	for _, f := range parsed.SourceFields {
		refs = append(refs, SourceRef{Field: f})
	}
	return FormFieldAnswer{
		Label:         field.Label,
		Value:         strings.TrimSpace(parsed.Value),
		LowConfidence: parsed.LowConfidence,
		SourceRefs:    refs,
	}, nil
}

func AnswerFormFields(ctx context.Context, cfg config.Config, fields []ClassifiedField, profile map[string]any, evidence EvidenceMap, jd JdRequirements, jobCompany, coverLetter string) ([]FormFieldAnswer, []FormAnswerLint, error) {
	routes := ResolveFieldRoutes(fields)
	enrichRoutesWithIntent(ctx, cfg, routes, fields)

	answers, err := answerRoutedFields(ctx, cfg, routes, fields, profile, evidence, jd, jobCompany, coverLetter)
	if err != nil {
		return nil, nil, err
	}

	ordered := OrderFormAnswers(answers, fields)
	lints := LintFormAnswers(fields, routes, ordered, coverLetter)
	if len(lintFailures(lints)) > 0 {
		ordered = RetryLintFailures(ctx, cfg, fields, routes, ordered, lints, profile, evidence, jd, jobCompany)
		lints = LintFormAnswers(fields, routes, ordered, coverLetter)
	}
	return ordered, lints, nil
}

func OrderFormAnswers(answers []FormFieldAnswer, formFields []ClassifiedField) []FormFieldAnswer {
	byLabel := map[string]FormFieldAnswer{}
	for _, a := range answers {
		byLabel[a.Label] = a
	}
	out := make([]FormFieldAnswer, len(formFields))
	for i, f := range formFields {
		if a, ok := byLabel[f.Label]; ok {
			out[i] = a
		} else {
			out[i] = FormFieldAnswer{Label: f.Label, Value: "", LowConfidence: f.Required}
		}
	}
	return out
}

func FinalizeFormAnswers(answers []FormFieldAnswer, classified []ClassifiedField, resumePDFURL, coverLetterText, coverLetterPDFURL string) []FormFieldAnswer {
	ordered := OrderFormAnswers(answers, classified)
	for i, cf := range classified {
		switch cf.FieldClass {
		case FieldFile:
			ordered[i].Value = resumePDFURL
		case FieldCoverLetter:
			if coverLetterPDFURL != "" {
				ordered[i].Value = coverLetterPDFURL
			} else {
				ordered[i].Value = coverLetterText
			}
		case FieldCoverLetterText:
			ordered[i].Value = coverLetterText
		}
	}
	return ordered
}

var behavioralStoryKeys = []struct {
	re  *regexp.Regexp
	key string
}{
	{regexp.MustCompile(`(?i)changed your mind|strongly held belief`), "storyDisagreementOrConflict"},
	{regexp.MustCompile(`(?i)impactful feedback|feedback you`), "storyDifficultFeedback"},
	{regexp.MustCompile(`(?i)taught yourself|latest skill`), "storyMentoringTeaching"},
	{regexp.MustCompile(`(?i)additional information`), "storyHardestTechnicalChallenge"},
}

func githubProjectContext(profile map[string]any) string {
	github := profileStr(profile, "githubUrl")
	raw, ok := profile["projects"]
	if !ok {
		if github != "" {
			return "\nGitHub profile: " + github + "\nWrite 2-3 sentences about a real repository from the profile — do not paste the URL as the answer.\n"
		}
		return ""
	}
	projectsJSON, err := json.Marshal(raw)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("\nGitHub profile: %s\nProjects from profile (describe one repo technically — do NOT output a URL as the answer):\n%s\n", github, string(projectsJSON))
}

func primaryBehavioralStory(profile map[string]any, label string) (string, string) {
	for _, m := range behavioralStoryKeys {
		if m.re.MatchString(label) {
			if s := profileStr(profile, m.key); s != "" {
				return s, m.key
			}
		}
	}
	return "", ""
}
