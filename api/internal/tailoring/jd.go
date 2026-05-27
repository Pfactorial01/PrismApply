package tailoring

import (
	"context"
	"fmt"

	"prismapply/api/internal/config"
	"prismapply/api/internal/matching"
)

var jdRequirementsSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"roleTitleVariants":    arrayOfStrings(),
		"seniority":            map[string]any{"type": "string"},
		"locationPolicy":       map[string]any{"type": "string"},
		"mustHaveSkills":       arrayOfStrings(),
		"niceToHaveSkills":     arrayOfStrings(),
		"responsibilityThemes": arrayOfStrings(),
		"atsKeywords":          arrayOfStrings(),
		"stack":                arrayOfStrings(),
	},
	"required":             []string{"roleTitleVariants", "seniority", "locationPolicy", "mustHaveSkills", "niceToHaveSkills", "responsibilityThemes", "atsKeywords", "stack"},
	"additionalProperties": false,
}

const jdSystemPrompt = `You extract structured hiring requirements from a job posting.
Use verbatim phrases from the posting for ATS keywords when possible.
Do not invent requirements not supported by the text.
Seniority values: intern, junior, mid, senior, staff, principal, lead, manager, director, unknown.
Location policy: remote, hybrid, onsite, flexible, unknown.`

func ExtractJdRequirements(ctx context.Context, cfg config.Config, title, company, location, description string, facts matching.JobFacts) (JdRequirements, error) {
	user := fmt.Sprintf(`Title: %s
Company: %s
Location: %s
Seniority (parsed): %s
Remote policy: %s
Employment: %s

Description:
%s`, title, company, orDefault(location, "Not specified"),
		orDefault(facts.SeniorityLevel, "unknown"),
		orDefault(facts.RemotePolicy, "unknown"),
		orDefault(facts.EmploymentType, "unknown"),
		orDefault(description, "No description available"))

	var parsed JdRequirements
	if err := CallJSONLLM(ctx, cfg, jdSystemPrompt, user, "jd_requirements", jdRequirementsSchema, 0.25, &parsed); err != nil {
		return JdRequirements{}, err
	}
	if facts.SeniorityLevel != "" && facts.SeniorityLevel != "unknown" {
		parsed.Seniority = facts.SeniorityLevel
	}
	if facts.RemotePolicy != "" && facts.RemotePolicy != "unknown" {
		parsed.LocationPolicy = facts.RemotePolicy
	}
	return parsed, nil
}

func arrayOfStrings() map[string]any {
	return map[string]any{
		"type":  "array",
		"items": map[string]any{"type": "string"},
	}
}

func orDefault(s, def string) string {
	if s == "" {
		return def
	}
	return s
}
