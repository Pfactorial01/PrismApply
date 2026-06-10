package handlers

import (
	"strings"

	"github.com/google/uuid"
)

var knownEmploymentTypes = map[string]string{
	"full_time":  "full_time",
	"fulltime":   "full_time",
	"permanent":  "full_time",
	"employee":   "full_time",
	"part_time":  "part_time",
	"parttime":   "part_time",
	"internship": "internship",
	"intern":     "internship",
	"coop":       "coop",
	"co-op":      "coop",
	"freelance":  "freelance",
	"contract":   "freelance",
}

func normalizeEmploymentType(raw string, hasRole bool) string {
	key := strings.ToLower(strings.TrimSpace(raw))
	key = strings.ReplaceAll(key, " ", "_")
	key = strings.ReplaceAll(key, "-", "_")
	if v, ok := knownEmploymentTypes[key]; ok {
		return v
	}
	if hasRole {
		return "full_time"
	}
	return "internship"
}

func normalizeSummaryBullets(m map[string]any) string {
	if s := strMap(m, "summaryBullets"); s != "" {
		return s
	}
	for _, key := range []string{"bullets", "accomplishments", "responsibilities", "highlights", "description"} {
		if s := bulletsFromValue(m[key]); s != "" {
			return s
		}
	}
	return ""
}

func bulletsFromValue(v any) string {
	switch t := v.(type) {
	case string:
		return formatBulletLines(splitLines(t))
	case []any:
		var lines []string
		for _, item := range t {
			if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
				lines = append(lines, strings.TrimSpace(s))
			}
		}
		return formatBulletLines(lines)
	case []string:
		return formatBulletLines(t)
	default:
		return ""
	}
}

func splitLines(s string) []string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	parts := strings.Split(s, "\n")
	var out []string
	for _, p := range parts {
		if line := strings.TrimSpace(p); line != "" {
			out = append(out, line)
		}
	}
	return out
}

func formatBulletLines(lines []string) string {
	var formatted []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if !strings.HasPrefix(line, "•") && !strings.HasPrefix(line, "-") && !strings.HasPrefix(line, "*") {
			line = "• " + line
		}
		formatted = append(formatted, line)
	}
	return strings.Join(formatted, "\n")
}

func strMap(m map[string]any, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func boolMap(m map[string]any, key string) bool {
	v, ok := m[key]
	if !ok {
		return false
	}
	b, _ := v.(bool)
	return b
}

// normalizeParsedWorkEntries assigns IDs and normalizes employment type + bullet fields from AI output.
func normalizeParsedWorkEntries(profile map[string]any) {
	raw, ok := profile["workEntries"].([]any)
	if !ok || len(raw) == 0 {
		return
	}
	out := make([]any, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		company := strMap(m, "company")
		role := strMap(m, "role")
		if company == "" && role == "" {
			continue
		}
		hasRole := company != "" || role != ""
		entry := map[string]any{
			"id":              strMap(m, "id"),
			"company":         company,
			"role":            role,
			"startDate":       strMap(m, "startDate"),
			"endDate":         strMap(m, "endDate"),
			"isCurrent":       boolMap(m, "isCurrent"),
			"employmentType":  normalizeEmploymentType(strMap(m, "employmentType"), hasRole),
			"summaryBullets":  normalizeSummaryBullets(m),
		}
		if entry["id"] == "" {
			entry["id"] = uuid.NewString()
		}
		out = append(out, entry)
	}
	if len(out) > 0 {
		profile["workEntries"] = out
	}
}
