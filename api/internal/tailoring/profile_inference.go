package tailoring

import (
	"encoding/json"
	"fmt"
	"strings"

	"prismapply/api/internal/matching"
)

// resolveInferableSelect maps common application selects from structured profile fields.
// Returns ("", true) when no confident inference is available.
func resolveInferableSelect(field ClassifiedField, profile map[string]any) (string, bool) {
	if len(field.Options) == 0 {
		return "", true
	}
	label := strings.ToLower(field.Label)

	if v, ok := inferEnglishLevel(field.Options, profile); ok {
		return v, false
	}
	if strings.Contains(label, "latin american") {
		return inferLatinAmerica(field.Options, profile), false
	}
	if strings.Contains(label, "time zone") || strings.Contains(label, "timezone") {
		if v, ok := inferUSTimezone(field.Options, profile); ok {
			return v, false
		}
	}
	if v, ok := inferWorkAuthSelect(field, profile); ok {
		return v, false
	}
	if v, ok := inferStackYears(field, profile); ok {
		return v, false
	}
	if strings.Contains(label, "notice period") {
		if v, ok := inferNoticePeriod(field.Options, profile); ok {
			return v, false
		}
	}
	if strings.Contains(label, "compensation") || strings.Contains(label, "salary") {
		if v, ok := inferCompensation(field, profile); ok {
			return v, false
		}
	}
	if (strings.Contains(label, "region") || strings.Contains(label, "country")) && strings.Contains(label, "based") {
		if v, ok := inferHomeRegion(field.Options, profile); ok {
			return v, false
		}
	}
	if strings.Contains(label, "saas") && strings.Contains(label, "product") {
		if v, ok := inferYesNoFromExperience(field.Options, profile, true); ok {
			return v, false
		}
	}
	if strings.Contains(label, "cloud certification") {
		return pickOption(field.Options, "No"), false
	}

	return "", true
}

func inferEnglishLevel(options []string, profile map[string]any) (string, bool) {
	level := strings.ToLower(profileStr(profile, "englishProficiency"))
	if level == "" {
		return "", false
	}
	candidates := []string{}
	switch level {
	case "native":
		candidates = []string{"native", "native or bilingual", "fluent", "advanced", "full professional", "c2"}
	case "fluent":
		candidates = []string{"fluent", "advanced", "full professional", "professional", "c1"}
	case "professional":
		candidates = []string{"professional", "full professional", "advanced", "business", "b2"}
	case "conversational":
		candidates = []string{"conversational", "intermediate", "working", "b1"}
	default:
		candidates = []string{level}
	}
	for _, c := range candidates {
		if v := pickOption(options, c); v != "" {
			return v, true
		}
	}
	return "", false
}

func inferLatinAmerica(options []string, profile map[string]any) string {
	region := profileStr(profile, "region")
	country := strings.ToLower(profileStr(profile, "country"))
	if region == "latam" {
		return pickOption(options, "Yes")
	}
	latamCountries := []string{"mexico", "brazil", "argentina", "colombia", "chile", "peru"}
	for _, c := range latamCountries {
		if strings.Contains(country, c) {
			return pickOption(options, "Yes")
		}
	}
	return pickOption(options, "No")
}

func inferUSTimezone(options []string, profile map[string]any) (string, bool) {
	tz := profileStr(profile, "timezone")
	note := strings.ToLower(profileStr(profile, "timezoneOtherNote"))
	if strings.HasPrefix(tz, "americas_") {
		return pickOption(options, "Yes"), true
	}
	if strings.Contains(note, "wat") || strings.Contains(note, "utc+1") || strings.Contains(note, "west africa") {
		return pickOption(options, "No"), true
	}
	if tz == "other" && note != "" && !strings.Contains(note, "eastern") && !strings.Contains(note, "pacific") {
		return pickOption(options, "No"), true
	}
	return "", false
}

func inferWorkAuthSelect(field ClassifiedField, profile map[string]any) (string, bool) {
	label := strings.ToLower(field.Label)
	if strings.Contains(label, "sponsorship") || (strings.Contains(label, "require") && strings.Contains(label, "support")) {
		needs := boolPref(profile, "needsVisaSponsorship")
		if needs {
			return pickOption(field.Options, "Yes"), true
		}
		return pickOption(field.Options, "No"), true
	}
	if strings.Contains(label, "authorized") || strings.Contains(label, "legal authorization") {
		if strings.Contains(label, "u.s") || strings.Contains(label, " us ") || strings.Contains(label, "united states") {
			if boolPref(profile, "workAuthorizedInUS") {
				return pickOption(field.Options, "Yes"), true
			}
			return pickOption(field.Options, "No"), true
		}
		if strings.Contains(label, "canada") {
			if boolPref(profile, "workAuthorizedInCanada") {
				return pickOption(field.Options, "Yes"), true
			}
			return pickOption(field.Options, "No"), true
		}
		// Authorized in country of residence
		if strings.Contains(label, "that country") {
			return pickOption(field.Options, "Yes"), true
		}
	}
	return "", false
}

func inferStackYears(field ClassifiedField, profile map[string]any) (string, bool) {
	label := strings.ToLower(field.Label)
	key := stackYearsKey(label)
	if key == "" {
		return "", false
	}
	years := stackYearsValue(profile, key)
	if years == "" {
		years = inferStackYearsFromProfile(label, profile, key)
	}
	if years == "" {
		return "", false
	}
	if v := mapYearsToOption(years, field.Options); v != "" {
		return v, true
	}
	return "", false
}

func stackYearsKey(label string) string {
	switch {
	case strings.Contains(label, "golang") || strings.Contains(label, " go "):
		return "go"
	case strings.Contains(label, "python") && (strings.Contains(label, "numpy") || strings.Contains(label, "scipy") || strings.Contains(label, "data")):
		return "python_data"
	case strings.Contains(label, "python"):
		return "python"
	case strings.Contains(label, "react"):
		return "react"
	case strings.Contains(label, "node"):
		return "node"
	case strings.Contains(label, "aws"):
		return "aws"
	case strings.Contains(label, "distributed"):
		return "distributed_systems"
	default:
		return ""
	}
}

func stackYearsValue(profile map[string]any, key string) string {
	raw, ok := profile["stackYears"].(map[string]any)
	if !ok || raw == nil {
		return ""
	}
	if v, ok := raw[key].(string); ok {
		return strings.TrimSpace(v)
	}
	return ""
}

func inferStackYearsFromProfile(label string, profile map[string]any, key string) string {
	yearsExp := profileStr(profile, "yearsExperience")
	switch key {
	case "react", "node":
		if yearsExp == "3-5" || yearsExp == "5-8" || yearsExp == "8-12" || yearsExp == "12+" {
			return "3_plus"
		}
		if yearsExp == "1-3" {
			return "1_2"
		}
	case "go":
		return "less_than_2"
	case "python_data":
		return "none"
	case "aws":
		if containsSlug(profile, "selectedToolSlugs", "aws") {
			return "2_4"
		}
	case "distributed_systems":
		if yearsExp == "3-5" || yearsExp == "5-8" {
			return "2_4"
		}
	}
	return ""
}

func containsSlug(profile map[string]any, field, slug string) bool {
	raw, ok := profile[field].([]any)
	if !ok {
		return false
	}
	for _, s := range raw {
		if str, ok := s.(string); ok && str == slug {
			return true
		}
	}
	return false
}

func mapYearsToOption(years string, options []string) string {
	years = strings.ToLower(strings.TrimSpace(years))
	switch years {
	case "none", "0", "no", "no_experience":
		for _, hint := range []string{"no experience", "i have no", "i do not", "none"} {
			if v := pickOption(options, hint); v != "" {
				return v
			}
		}
	case "less_than_2", "0_1", "1_2", "<2":
		for _, hint := range []string{"less than 2", "0-1", "0 to 1", "under 2"} {
			if v := pickOption(options, hint); v != "" {
				return v
			}
		}
	case "2_4", "between_3_4", "3_4":
		for _, hint := range []string{"between 3 and 4", "2-4", "3-4", "3 to 4"} {
			if v := pickOption(options, hint); v != "" {
				return v
			}
		}
	case "3_plus", "5_plus", "more_than_5":
		for _, hint := range []string{"3 years or more", "more than 5", "5+", "3+"} {
			if v := pickOption(options, hint); v != "" {
				return v
			}
		}
	}
	for _, opt := range options {
		if strings.Contains(strings.ToLower(opt), years) {
			return opt
		}
	}
	return ""
}

func inferNoticePeriod(options []string, profile map[string]any) (string, bool) {
	avail := profileStr(profile, "startAvailability")
	switch avail {
	case "immediate":
		if v := pickOption(options, "Immediate"); v != "" {
			return v, true
		}
		return pickOption(options, "0"), true
	case "2_weeks":
		for _, hint := range []string{"2 week", "two week", "14 day"} {
			if v := pickOption(options, hint); v != "" {
				return v, true
			}
		}
	case "1_month":
		for _, hint := range []string{"1 month", "30 day", "four week"} {
			if v := pickOption(options, hint); v != "" {
				return v, true
			}
		}
	}
	return "", false
}

func inferCompensation(field ClassifiedField, profile map[string]any) (string, bool) {
	label := strings.ToLower(field.Label)
	band := profileStr(profile, "compensationBand")
	note := profileStr(profile, "compensationExtraNote")
	if strings.Contains(label, "monthly") {
		switch band {
		case "under_80":
			for _, hint := range []string{"5500", "6000", "6500", "5000", "7000"} {
				if v := pickOption(field.Options, hint); v != "" {
					return v, true
				}
			}
		case "80_120":
			for _, hint := range []string{"8000", "9000", "10000"} {
				if v := pickOption(field.Options, hint); v != "" {
					return v, true
				}
			}
		}
	}
	if strings.Contains(label, "salary") && !strings.Contains(label, "monthly") {
		switch band {
		case "under_80":
			if note != "" {
				return note, true
			}
			return "Under $80,000 USD", true
		case "80_120":
			return "$80,000–$120,000", true
		}
	}
	return "", false
}

func inferHomeRegion(options []string, profile map[string]any) (string, bool) {
	country := profileStr(profile, "country")
	if country != "" {
		if v := pickOption(options, country); v != "" {
			return v, true
		}
		for _, opt := range options {
			if strings.Contains(strings.ToLower(opt), strings.ToLower(country)) {
				return opt, true
			}
		}
	}
	region := matching.LabelForSlug(profileStr(profile, "region"))
	if region != "" && region != "Other" {
		if v := pickOption(options, region); v != "" {
			return v, true
		}
	}
	return "", false
}

func inferYesNoFromExperience(options []string, profile map[string]any, _ bool) (string, bool) {
	if len(profileStr(profile, "currentCompany")) > 0 || profileStr(profile, "yearsExperience") != "" {
		return pickOption(options, "Yes"), true
	}
	return pickOption(options, "No"), true
}

func formatLocationWithCountry(city, region, country string) string {
	country = strings.TrimSpace(country)
	if country != "" {
		parts := filterNonEmpty([]string{strings.TrimSpace(city), country})
		return strings.Join(parts, ", ")
	}
	return formatLocationAnswer(city, region)
}

func buildFormInferenceContext(profile map[string]any) string {
	type summary struct {
		Country                string         `json:"country"`
		Region                 string         `json:"region"`
		City                   string         `json:"city"`
		Timezone               string         `json:"timezone"`
		TimezoneNote           string         `json:"timezoneNote"`
		EnglishProficiency     string         `json:"englishProficiency"`
		YearsExperience        string         `json:"yearsExperience"`
		StartAvailability      string         `json:"startAvailability"`
		CompensationBand       string         `json:"compensationBand"`
		CompensationNote       string         `json:"compensationExtraNote"`
		WorkAuthorizedInUS     bool           `json:"workAuthorizedInUS"`
		WorkAuthorizedInCanada bool           `json:"workAuthorizedInCanada"`
		NeedsVisaSponsorship   bool           `json:"needsVisaSponsorship"`
		WorkAuthNote           string         `json:"workAuthOtherNote"`
		StackYears             map[string]any `json:"stackYears"`
		Tools                  []any          `json:"selectedToolSlugs"`
	}
	s := summary{
		Country:                profileStr(profile, "country"),
		Region:                 matching.LabelForSlug(profileStr(profile, "region")),
		City:                   profileStr(profile, "cityOrDetail"),
		Timezone:               profileStr(profile, "timezone"),
		TimezoneNote:           profileStr(profile, "timezoneOtherNote"),
		EnglishProficiency:     profileStr(profile, "englishProficiency"),
		YearsExperience:        profileStr(profile, "yearsExperience"),
		StartAvailability:      profileStr(profile, "startAvailability"),
		CompensationBand:       profileStr(profile, "compensationBand"),
		CompensationNote:       profileStr(profile, "compensationExtraNote"),
		WorkAuthorizedInUS:     boolPref(profile, "workAuthorizedInUS"),
		WorkAuthorizedInCanada: boolPref(profile, "workAuthorizedInCanada"),
		NeedsVisaSponsorship:   boolPref(profile, "needsVisaSponsorship"),
		WorkAuthNote:           profileStr(profile, "workAuthOtherNote"),
	}
	if raw, ok := profile["stackYears"].(map[string]any); ok {
		s.StackYears = raw
	}
	if raw, ok := profile["selectedToolSlugs"].([]any); ok {
		s.Tools = raw
	}
	b, _ := json.MarshalIndent(s, "", "  ")
	return string(b)
}

func normalizeSelectValue(val string, options []string) string {
	val = strings.TrimSpace(val)
	if val == "" || len(options) == 0 {
		return val
	}
	if optionMatches(val, options) {
		return val
	}
	if v := pickOption(options, val); v != "" {
		return v
	}
	lower := strings.ToLower(val)
	for _, opt := range options {
		if strings.ToLower(opt) == lower {
			return opt
		}
	}
	return val
}

type batchAnswerRow struct {
	Position    int
	Label       string
	Value       string
	SourceField string
}

func mergeBatchAnswers(needsLLM []ClassifiedField, profile map[string]any, parsed []batchAnswerRow) []FormFieldAnswer {
	byPos := map[int]FormFieldAnswer{}
	byLabel := map[string]FormFieldAnswer{}
	for _, a := range parsed {
		val := normalizeSelectValue(a.Value, optionsForPosition(needsLLM, a.Position, a.Label))
		ans := FormFieldAnswer{
			Label:         a.Label,
			Value:         val,
			LowConfidence: strings.TrimSpace(val) == "",
		}
		if a.SourceField != "" {
			ans.SourceRefs = []SourceRef{{Field: a.SourceField, Excerpt: truncate(val, 80)}}
		}
		if a.Position > 0 {
			byPos[a.Position] = ans
		}
		if a.Label != "" {
			byLabel[a.Label] = ans
		}
	}
	var out []FormFieldAnswer
	for _, f := range needsLLM {
		if a, ok := byLabel[f.Label]; ok && strings.TrimSpace(a.Value) != "" {
			a.Label = f.Label
			out = append(out, a)
			continue
		}
		if a, ok := byPos[f.Position+1]; ok {
			a.Label = f.Label
			out = append(out, a)
			continue
		}
		if val, low := resolveInferableSelect(f, profile); val != "" && !low {
			out = append(out, FormFieldAnswer{Label: f.Label, Value: val})
			continue
		}
		out = append(out, FormFieldAnswer{Label: f.Label, Value: "", LowConfidence: f.Required})
	}
	return out
}

func optionsForPosition(fields []ClassifiedField, position int, label string) []string {
	for _, f := range fields {
		if f.Position+1 == position || f.Label == label {
			return f.Options
		}
	}
	return nil
}

func batchFormUserSuffix(profile map[string]any) string {
	return fmt.Sprintf("\nStructured inference context (use for select/yes-no answers; infer conservatively, never invent):\n%s", buildFormInferenceContext(profile))
}
