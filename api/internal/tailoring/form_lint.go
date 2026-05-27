package tailoring

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"prismapply/api/internal/config"
)

// FormAnswerLint records a validation issue for one field or the cover letter.
type FormAnswerLint struct {
	Label    string
	Position int
	Rule     string
	Severity string // warn | fail
	Message  string
}

var (
	placeholderPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\[(your name|name|date|company|insert)\]`),
		regexp.MustCompile(`(?i)\bTBD\b`),
		regexp.MustCompile(`(?i)\bTODO\b`),
		regexp.MustCompile(`(?i)\blorem ipsum\b`),
	}
	urlPattern = regexp.MustCompile(`(?i)^https?://\S+$`)
)

func isBareURL(s string) bool {
	return urlPattern.MatchString(strings.TrimSpace(s))
}

func isProseExpected(format ExpectedFormat) bool {
	return format == FormatProseShort || format == FormatProseLong
}

// LintFormAnswers runs lightweight checks on answers vs expected formats from routing.
func LintFormAnswers(fields []ClassifiedField, routes []FieldRoute, answers []FormFieldAnswer, coverLetter string) []FormAnswerLint {
	var out []FormAnswerLint
	byLabel := map[string]FormFieldAnswer{}
	for _, a := range answers {
		byLabel[a.Label] = a
	}

	valueCounts := map[string][]string{}
	for _, a := range answers {
		v := strings.TrimSpace(a.Value)
		if v == "" || strings.HasPrefix(v, "http") && strings.Contains(v, ".pdf") {
			continue
		}
		valueCounts[v] = append(valueCounts[v], a.Label)
	}

	for i, cf := range fields {
		route := routes[i]
		a, ok := byLabel[cf.Label]
		if !ok {
			if cf.Required && route.ExpectedFormat != FormatSkip && route.ExpectedFormat != FormatEmptyOK {
				out = append(out, FormAnswerLint{
					Label: cf.Label, Position: cf.Position, Rule: "required_empty",
					Severity: "fail", Message: "required field has no answer",
				})
			}
			continue
		}
		val := strings.TrimSpace(a.Value)
		out = append(out, lintFieldAnswer(cf, route, val)...)

		if cf.Required && val == "" && route.ExpectedFormat != FormatEmptyOK && route.ExpectedFormat != FormatSkip {
			out = append(out, FormAnswerLint{
				Label: cf.Label, Position: cf.Position, Rule: "required_empty",
				Severity: "fail", Message: "required field is empty",
			})
		}

		if len(cf.Options) > 0 && val != "" && route.ExpectedFormat == FormatSelectOption {
			if !optionMatches(val, cf.Options) {
				out = append(out, FormAnswerLint{
					Label: cf.Label, Position: cf.Position, Rule: "select_not_in_options",
					Severity: "warn", Message: "answer not in field options",
				})
			}
		}
	}

	for val, labels := range valueCounts {
		if len(labels) < 2 {
			continue
		}
		if isBareURL(val) && countNonURLFields(labels, routes) >= 2 {
			for _, lbl := range labels {
				r := routeByLabel(routes, lbl)
				if r != nil && isProseExpected(r.ExpectedFormat) {
					out = append(out, FormAnswerLint{
						Label: lbl, Rule: "duplicate_url_in_prose_field",
						Severity: "fail", Message: "URL duplicated into a prose field",
					})
				}
			}
		}
	}

	out = append(out, lintCoverLetter(coverLetter)...)
	return out
}

func lintFieldAnswer(cf ClassifiedField, route FieldRoute, val string) []FormAnswerLint {
	if val == "" || route.ExpectedFormat == FormatSkip || route.ExpectedFormat == FormatEmptyOK {
		return nil
	}
	var out []FormAnswerLint

	for _, p := range placeholderPatterns {
		if p.MatchString(val) {
			out = append(out, FormAnswerLint{
				Label: cf.Label, Position: cf.Position, Rule: "placeholder_text",
				Severity: "fail", Message: "answer contains placeholder text",
			})
			break
		}
	}

	switch route.ExpectedFormat {
	case FormatURL:
		if !isBareURL(val) && !strings.Contains(val, "github.com") && !strings.Contains(val, "linkedin.com") {
			out = append(out, FormAnswerLint{
				Label: cf.Label, Position: cf.Position, Rule: "expected_url",
				Severity: "warn", Message: "expected a URL",
			})
		}
	case FormatProseShort, FormatProseLong:
		if isBareURL(val) {
			out = append(out, FormAnswerLint{
				Label: cf.Label, Position: cf.Position, Rule: "url_in_prose_field",
				Severity: "fail", Message: "prose field contains only a URL",
			})
		}
		if len(val) < 40 && cf.Required {
			out = append(out, FormAnswerLint{
				Label: cf.Label, Position: cf.Position, Rule: "prose_too_short",
				Severity: "warn", Message: "prose answer may be too short",
			})
		}
	case FormatYesNo:
		lv := strings.ToLower(val)
		if lv != "yes" && lv != "no" && !optionMatches(val, cf.Options) {
			out = append(out, FormAnswerLint{
				Label: cf.Label, Position: cf.Position, Rule: "expected_yes_no",
				Severity: "warn", Message: "expected Yes or No",
			})
		}
	}
	return out
}

func lintCoverLetter(coverLetter string) []FormAnswerLint {
	var out []FormAnswerLint
	for _, p := range placeholderPatterns {
		if p.MatchString(coverLetter) {
			out = append(out, FormAnswerLint{
				Label: "(cover letter)", Rule: "placeholder_text",
				Severity: "fail", Message: "cover letter contains placeholder text",
			})
			break
		}
	}
	return out
}

func optionMatches(val string, options []string) bool {
	lv := strings.ToLower(strings.TrimSpace(val))
	for _, o := range options {
		if strings.ToLower(strings.TrimSpace(o)) == lv {
			return true
		}
	}
	return false
}

func countNonURLFields(labels []string, routes []FieldRoute) int {
	n := 0
	for _, lbl := range labels {
		r := routeByLabel(routes, lbl)
		if r != nil && r.ExpectedFormat == FormatURL {
			continue
		}
		n++
	}
	return n
}

func lintMessages(lints []FormAnswerLint) []string {
	var msgs []string
	for _, l := range lints {
		msg := l.Label
		if l.Label == "" {
			msg = "field"
		}
		msgs = append(msgs, fmt.Sprintf("%s: %s (%s)", msg, l.Message, l.Rule))
	}
	return msgs
}

func lintFailures(lints []FormAnswerLint) []FormAnswerLint {
	var fails []FormAnswerLint
	for _, l := range lints {
		if l.Severity == "fail" {
			fails = append(fails, l)
		}
	}
	return fails
}

// RetryLintFailures re-answers fields that failed lint using the behavioral specialist.
func RetryLintFailures(
	ctx context.Context,
	cfg config.Config,
	fields []ClassifiedField,
	routes []FieldRoute,
	answers []FormFieldAnswer,
	lints []FormAnswerLint,
	profile map[string]any,
	evidence EvidenceMap,
	jd JdRequirements,
	jobCompany string,
) []FormFieldAnswer {
	failures := lintFailures(lints)
	if len(failures) == 0 {
		return answers
	}

	byLabel := map[string]int{}
	for i, a := range answers {
		byLabel[a.Label] = i
	}

	retried := 0
	for _, fail := range failures {
		if retried >= 3 {
			break
		}
		switch fail.Rule {
		case "url_in_prose_field", "duplicate_url_in_prose_field", "prose_too_short":
		default:
			continue
		}
		cfIdx := -1
		for i, cf := range fields {
			if cf.Label == fail.Label {
				cfIdx = i
				break
			}
		}
		if cfIdx < 0 {
			continue
		}
		cf := fields[cfIdx]
		routes[cfIdx].Strategy = StrategyBehavioral
		a, err := answerBehavioralField(ctx, cfg, cf, profile, evidence, jd, jobCompany)
		if err != nil {
			slog.Warn("lint_retry_failed", "label", fail.Label, "error", err)
			continue
		}
		if isBareURL(strings.TrimSpace(a.Value)) {
			continue
		}
		if idx, ok := byLabel[fail.Label]; ok {
			answers[idx] = a
			retried++
			slog.Info("lint_retry_ok", "label", fail.Label)
		}
	}
	return answers
}
