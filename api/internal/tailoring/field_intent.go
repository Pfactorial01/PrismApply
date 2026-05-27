package tailoring

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"prismapply/api/internal/config"
)

// AnswerStrategy routes a field to the correct specialist answerer.
type AnswerStrategy string

const (
	StrategySkipCoverText   AnswerStrategy = "skip_cover_text"
	StrategyDeterministic   AnswerStrategy = "deterministic"
	StrategyCompliance      AnswerStrategy = "compliance_select"
	StrategyBehavioral      AnswerStrategy = "behavioral"
	StrategyBatchLLM        AnswerStrategy = "batch_llm"
	StrategyNeedsIntent     AnswerStrategy = "needs_intent"
)

// ExpectedFormat describes the shape of a valid answer for linting.
type ExpectedFormat string

const (
	FormatSkip         ExpectedFormat = "skip"
	FormatURL          ExpectedFormat = "url"
	FormatIdentity     ExpectedFormat = "identity"
	FormatLocation     ExpectedFormat = "location"
	FormatYesNo        ExpectedFormat = "yes_no"
	FormatSelectOption ExpectedFormat = "select_option"
	FormatProseShort   ExpectedFormat = "prose_short"
	FormatProseLong    ExpectedFormat = "prose_long"
	FormatEmptyOK      ExpectedFormat = "empty_ok" // EEO voluntary
)

// FieldRoute is the routing plan for one form field.
type FieldRoute struct {
	Position         int
	Label            string
	FieldType        string
	Required         bool
	Options          []string
	FieldClass       FieldClass
	Strategy         AnswerStrategy
	ExpectedFormat   ExpectedFormat
	ProfileField     string
	RefersToPosition int
	Confident        bool
	GroundIn         []string
}

var (
	proseQuestionPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\b(describe|explain|tell us|why|what makes|how would|what interests)\b`),
		regexp.MustCompile(`(?i)\b\d.?[\s-]*\d?\s*sentences?\b`),
		regexp.MustCompile(`(?i)\btechnically interesting\b`),
		regexp.MustCompile(`(?i)\bexample of\b`),
		regexp.MustCompile(`(?i)\badditional information\b`),
	}
	clearIdentityPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\bfull name\b`),
		regexp.MustCompile(`(?i)^name$`),
		regexp.MustCompile(`(?i)\bfirst name\b`),
		regexp.MustCompile(`(?i)\blast name\b`),
		regexp.MustCompile(`(?i)\bemail\b`),
		regexp.MustCompile(`(?i)\bphone\b`),
		regexp.MustCompile(`(?i)\bmobile\b`),
		regexp.MustCompile(`(?i)\blinkedin\b`),
		regexp.MustCompile(`(?i)\bportfolio\b`),
		regexp.MustCompile(`(?i)\bcurrent company\b`),
		regexp.MustCompile(`(?i)\btwitter\b`),
		regexp.MustCompile(`(?i)\bother website\b`),
	}
	complianceLabelPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\bsponsorship\b`),
		regexp.MustCompile(`(?i)\bexport control\b`),
		regexp.MustCompile(`(?i)\bclearance\b`),
		regexp.MustCompile(`(?i)\bwork authorization\b`),
		regexp.MustCompile(`(?i)\bauthorized to work\b`),
		regexp.MustCompile(`(?i)\bvisa\b`),
		regexp.MustCompile(`(?i)\bonsite\b.*\boffice\b`),
	}
)

var fieldIntentSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"intents": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"position":           map[string]any{"type": "number"},
					"intent":             map[string]any{"type": "string"},
					"expected_format":    map[string]any{"type": "string"},
					"answer_strategy":    map[string]any{"type": "string"},
					"profile_field":      map[string]any{"type": "string"},
					"refers_to_position": map[string]any{"type": "number"},
					"ground_in":          arrayOfStrings(),
				},
				"required":             []string{"position", "intent", "expected_format", "answer_strategy", "profile_field", "refers_to_position", "ground_in"},
				"additionalProperties": false,
			},
		},
	},
	"required":             []string{"intents"},
	"additionalProperties": false,
}

func isProseQuestion(label string) bool {
	return matchAny(label, proseQuestionPatterns)
}

func isClearIdentityLabel(label string) bool {
	if isProseQuestion(label) || isGitHubDescribeQuestion(label) {
		return false
	}
	if isGitHubLinkQuestion(label) {
		return true
	}
	return matchAny(label, clearIdentityPatterns)
}

func isComplianceLabel(label string) bool {
	return matchAny(label, complianceLabelPatterns)
}

// ResolveFieldRoutes applies rule-based routing for obvious fields; ambiguous fields stay on StrategyNeedsIntent.
func ResolveFieldRoutes(fields []ClassifiedField) []FieldRoute {
	routes := make([]FieldRoute, len(fields))
	for i, cf := range fields {
		routes[i] = resolveRuleRoute(cf)
	}
	return routes
}

func resolveRuleRoute(cf ClassifiedField) FieldRoute {
	r := FieldRoute{
		Position:   cf.Position,
		Label:      cf.Label,
		FieldType:  cf.FieldType,
		Required:   cf.Required,
		Options:    cf.Options,
		FieldClass: cf.FieldClass,
		Strategy:   StrategyNeedsIntent,
		Confident:  false,
	}

	switch cf.FieldClass {
	case FieldFile, FieldCoverLetter:
		r.Strategy = StrategyDeterministic
		r.ExpectedFormat = FormatSkip
		r.Confident = true
	case FieldCoverLetterText:
		r.Strategy = StrategySkipCoverText
		r.ExpectedFormat = FormatSkip
		r.Confident = true
	case FieldEEO:
		r.Strategy = StrategyDeterministic
		r.ExpectedFormat = FormatEmptyOK
		r.Confident = true
	case FieldLocation:
		r.Strategy = StrategyDeterministic
		r.ExpectedFormat = FormatLocation
		r.Confident = true
	case FieldIdentity:
		if isClearIdentityLabel(cf.Label) {
			r.Strategy = StrategyDeterministic
			r.ExpectedFormat = identityFormat(cf.Label)
			r.ProfileField = identityProfileField(cf.Label)
			r.Confident = true
		}
	case FieldSelect:
		if isComplianceLabel(cf.Label) {
			r.Strategy = StrategyCompliance
			r.ExpectedFormat = FormatSelectOption
			if yesNoOptions(cf.Options) {
				r.ExpectedFormat = FormatYesNo
			}
			r.Confident = true
		}
	case FieldBehavior:
		r.Strategy = StrategyBehavioral
		r.ExpectedFormat = proseFormat(cf)
		r.Confident = true
	case FieldLongText:
		if isGitHubDescribeQuestion(cf.Label) || isProseQuestion(cf.Label) || matchAny(cf.Label, behavioralPatterns) {
			r.Strategy = StrategyBehavioral
			r.ExpectedFormat = proseFormat(cf)
			if isGitHubDescribeQuestion(cf.Label) {
				r.GroundIn = []string{"projects", "githubUrl"}
			}
			r.Confident = true
		}
	case FieldShortText:
		if isClearIdentityLabel(cf.Label) {
			r.Strategy = StrategyDeterministic
			r.ExpectedFormat = identityFormat(cf.Label)
			r.ProfileField = identityProfileField(cf.Label)
			r.Confident = true
		} else if matchAny(strings.ToLower(cf.Label), locationPatterns) {
			r.Strategy = StrategyDeterministic
			r.ExpectedFormat = FormatLocation
			r.Confident = true
		}
	}
	return r
}

func identityFormat(label string) ExpectedFormat {
	if isGitHubLinkQuestion(label) || strings.Contains(strings.ToLower(label), "url") {
		return FormatURL
	}
	return FormatIdentity
}

func identityProfileField(label string) string {
	l := strings.ToLower(label)
	switch {
	case strings.Contains(l, "email"):
		return "email"
	case strings.Contains(l, "phone") || strings.Contains(l, "mobile"):
		return "phoneNumber"
	case strings.Contains(l, "linkedin"):
		return "linkedInUrl"
	case strings.Contains(l, "github"):
		return "githubUrl"
	case strings.Contains(l, "portfolio") || strings.Contains(l, "website"):
		return "portfolioUrl"
	case strings.Contains(l, "company"):
		return "currentCompany"
	case strings.Contains(l, "full name") || l == "name":
		return "fullName"
	case strings.Contains(l, "first name"):
		return "fullName"
	case strings.Contains(l, "last name"):
		return "fullName"
	default:
		return ""
	}
}

func proseFormat(cf ClassifiedField) ExpectedFormat {
	if cf.FieldType == "textarea" || cf.FieldClass == FieldLongText {
		if isGitHubDescribeQuestion(cf.Label) {
			return FormatProseShort
		}
		return FormatProseLong
	}
	return FormatProseShort
}

func yesNoOptions(options []string) bool {
	if len(options) == 0 {
		return false
	}
	hasYes, hasNo := false, false
	for _, o := range options {
		ol := strings.ToLower(strings.TrimSpace(o))
		if ol == "yes" {
			hasYes = true
		}
		if ol == "no" {
			hasNo = true
		}
	}
	return hasYes && hasNo
}

// BuildFieldIntentMap uses LLM to disambiguate fields that rule routing could not confidently classify.
func BuildFieldIntentMap(ctx context.Context, cfg config.Config, routes []FieldRoute, allFields []ClassifiedField) error {
	var ambiguous []FieldRoute
	for _, r := range routes {
		if !r.Confident {
			ambiguous = append(ambiguous, r)
		}
	}
	if len(ambiguous) == 0 {
		return nil
	}

	var formContext strings.Builder
	for _, cf := range allFields {
		formContext.WriteString(fmt.Sprintf("- position=%d label=%q type=%s required=%t\n", cf.Position+1, cf.Label, cf.FieldType, cf.Required))
	}

	var ambDesc strings.Builder
	for _, r := range ambiguous {
		line := fmt.Sprintf("- position=%d label=%q type=%s required=%t class=%s", r.Position+1, r.Label, r.FieldType, r.Required, r.FieldClass)
		if len(r.Options) > 0 {
			optJSON, _ := json.Marshal(r.Options)
			line += " options=" + string(optJSON)
		}
		ambDesc.WriteString(line)
		ambDesc.WriteString("\n")
	}

	system := `You classify job application form fields so answers use the correct format and handler.

For each field return:
- intent: short snake_case label (e.g. identity_email, url_github, prose_repo_description, compliance_sponsorship, location_city_state, behavioral_why_company)
- expected_format: one of url, identity, location, yes_no, select_option, prose_short, prose_long, empty_ok
- answer_strategy: one of deterministic, compliance_select, behavioral, batch_llm
- profile_field: profile JSON key when deterministic (fullName, email, phoneNumber, linkedInUrl, githubUrl, portfolioUrl, currentCompany) or empty string
- refers_to_position: 0 or position number if this question refers to a previous field (e.g. "describe the repo" refers to github link field)
- ground_in: profile keys to ground behavioral answers (projects, resumePlainText, story fields, githubUrl)

Rules:
- Link/paste/url fields → expected_format=url, answer_strategy=deterministic
- Describe/explain/sentences/why/interesting → expected_format=prose_short or prose_long, answer_strategy=behavioral (NOT url)
- Email/phone/name/company → deterministic identity
- Sponsorship/visa/authorization selects → compliance_select
- EEO/demographic voluntary fields → empty_ok, deterministic with empty value
- Never classify a "describe in sentences" field as url`

	user := fmt.Sprintf("Full form (for context):\n%s\n\nClassify these ambiguous fields:\n%s", formContext.String(), ambDesc.String())

	var parsed struct {
		Intents []struct {
			Position         int      `json:"position"`
			Intent             string   `json:"intent"`
			ExpectedFormat     string   `json:"expected_format"`
			AnswerStrategy     string   `json:"answer_strategy"`
			ProfileField       string   `json:"profile_field"`
			RefersToPosition   int      `json:"refers_to_position"`
			GroundIn           []string `json:"ground_in"`
		} `json:"intents"`
	}
	if err := CallJSONLLM(ctx, cfg, system, user, "field_intent_map", fieldIntentSchema, 0.1, &parsed); err != nil {
		return err
	}

	byPos := map[int]FieldRoute{}
	for _, r := range routes {
		byPos[r.Position+1] = r
	}
	for _, intent := range parsed.Intents {
		r, ok := byPos[intent.Position]
		if !ok {
			continue
		}
		applyIntent(&r, intent.Intent, intent.ExpectedFormat, intent.AnswerStrategy, intent.ProfileField, intent.RefersToPosition, intent.GroundIn)
		r.Confident = true
		byPos[intent.Position] = r
	}
	for i := range routes {
		if updated, ok := byPos[routes[i].Position+1]; ok {
			routes[i] = updated
		}
	}
	return nil
}

func applyIntent(r *FieldRoute, intent, expectedFormat, answerStrategy, profileField string, refersTo int, groundIn []string) {
	r.ExpectedFormat = mapExpectedFormat(expectedFormat, *r)
	r.ProfileField = strings.TrimSpace(profileField)
	r.RefersToPosition = refersTo
	r.GroundIn = groundIn

	switch strings.ToLower(answerStrategy) {
	case "deterministic":
		r.Strategy = StrategyDeterministic
	case "compliance_select":
		r.Strategy = StrategyCompliance
	case "behavioral":
		r.Strategy = StrategyBehavioral
	default:
		r.Strategy = StrategyBatchLLM
	}

	if r.ExpectedFormat == FormatURL && r.Strategy == StrategyBehavioral {
		r.Strategy = StrategyDeterministic
	}
	if strings.Contains(intent, "prose") || strings.Contains(intent, "describe") || strings.Contains(intent, "behavioral") {
		r.Strategy = StrategyBehavioral
		if r.ExpectedFormat == FormatURL || r.ExpectedFormat == FormatIdentity {
			r.ExpectedFormat = FormatProseShort
		}
	}
}

func mapExpectedFormat(s string, r FieldRoute) ExpectedFormat {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "url":
		return FormatURL
	case "identity":
		return FormatIdentity
	case "location":
		return FormatLocation
	case "yes_no":
		return FormatYesNo
	case "select_option":
		return FormatSelectOption
	case "prose_short":
		return FormatProseShort
	case "prose_long":
		return FormatProseLong
	case "empty_ok":
		return FormatEmptyOK
	default:
		if r.FieldType == "textarea" {
			return FormatProseLong
		}
		return FormatIdentity
	}
}

func fallbackAmbiguousRoutes(routes []FieldRoute) {
	for i := range routes {
		if routes[i].Confident {
			continue
		}
		r := &routes[i]
		switch r.FieldClass {
		case FieldBehavior, FieldLongText:
			r.Strategy = StrategyBehavioral
			r.ExpectedFormat = proseFormat(ClassifiedField{FormFieldRow: FormFieldRow{Label: r.Label, FieldType: r.FieldType}, FieldClass: r.FieldClass})
		case FieldSelect:
			r.Strategy = StrategyCompliance
			r.ExpectedFormat = FormatSelectOption
		default:
			r.Strategy = StrategyBatchLLM
			r.ExpectedFormat = FormatIdentity
		}
		r.Confident = true
	}
}

func answerRoutedFields(
	ctx context.Context,
	cfg config.Config,
	routes []FieldRoute,
	fields []ClassifiedField,
	profile map[string]any,
	evidence EvidenceMap,
	jd JdRequirements,
	jobCompany, coverLetter string,
) ([]FormFieldAnswer, error) {
	var answers []FormFieldAnswer
	var batchFields []ClassifiedField
	var batchRoutes []FieldRoute

	for i, cf := range fields {
		route := routes[i]
		switch route.Strategy {
		case StrategySkipCoverText:
			answers = append(answers, FormFieldAnswer{Label: cf.Label, Value: coverLetter})
		case StrategyDeterministic:
			answers = append(answers, answerDeterministicField(cf, route, profile, evidence.Identity))
		case StrategyCompliance:
			answers = append(answers, answerComplianceField(cf, route, profile, evidence.Identity))
		case StrategyBehavioral:
			a, err := answerBehavioralRouted(ctx, cfg, cf, route, profile, evidence, jd, jobCompany)
			if err != nil {
				return nil, err
			}
			answers = append(answers, a)
		case StrategyBatchLLM:
			batchFields = append(batchFields, cf)
			batchRoutes = append(batchRoutes, route)
		}
	}

	if len(batchFields) > 0 {
		batchAnswers, err := answerBatchFields(ctx, cfg, batchFields, profile, evidence.Identity, jd)
		if err != nil {
			return nil, err
		}
		answers = append(answers, batchAnswers...)
	}
	return answers, nil
}

func answerDeterministicField(cf ClassifiedField, route FieldRoute, profile map[string]any, identity map[string]string) FormFieldAnswer {
	if route.ExpectedFormat == FormatEmptyOK {
		return FormFieldAnswer{Label: cf.Label, Value: ""}
	}
	val := resolveIdentityAnswer(cf, identity, profile)
	if val == "" && route.ExpectedFormat == FormatLocation {
		val = resolveLocationAnswer(cf, identity, profile)
	}
	return FormFieldAnswer{
		Label:         cf.Label,
		Value:         val,
		LowConfidence: cf.Required && val == "",
	}
}

func answerComplianceField(cf ClassifiedField, route FieldRoute, profile map[string]any, identity map[string]string) FormFieldAnswer {
	val, low := resolveSelectAnswer(cf, identity, profile)
	return FormFieldAnswer{
		Label:         cf.Label,
		Value:         val,
		LowConfidence: low || (cf.Required && val == ""),
	}
}

func answerBehavioralRouted(ctx context.Context, cfg config.Config, cf ClassifiedField, route FieldRoute, profile map[string]any, evidence EvidenceMap, jd JdRequirements, jobCompany string) (FormFieldAnswer, error) {
	a, err := answerBehavioralField(ctx, cfg, cf, profile, evidence, jd, jobCompany)
	if err != nil {
		return FormFieldAnswer{}, err
	}
	if len(route.GroundIn) > 0 && isGitHubDescribeQuestion(cf.Label) {
		// already handled in answerBehavioralField via githubProjectContext
		return a, nil
	}
	if route.RefersToPosition > 0 {
		return a, nil
	}
	return a, nil
}

func enrichRoutesWithIntent(ctx context.Context, cfg config.Config, routes []FieldRoute, fields []ClassifiedField) {
	if err := BuildFieldIntentMap(ctx, cfg, routes, fields); err != nil {
		slog.Warn("field_intent_map_failed", "error", err)
		fallbackAmbiguousRoutes(routes)
		return
	}
	// Any still-unconfident fields get rule fallback.
	fallbackAmbiguousRoutes(routes)
	for i := range routes {
		if routes[i].Strategy == StrategyNeedsIntent {
			routes[i].Strategy = StrategyBatchLLM
			routes[i].ExpectedFormat = FormatIdentity
			routes[i].Confident = true
		}
	}
}

func routeByLabel(routes []FieldRoute, label string) *FieldRoute {
	for i := range routes {
		if routes[i].Label == label {
			return &routes[i]
		}
	}
	return nil
}
