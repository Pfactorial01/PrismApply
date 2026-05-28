package profilemode

import (
	"encoding/json"
	"fmt"
	"strings"
)

// CompileResumePlainText builds embeddable resume text from wizard fields for early-career profiles.
func CompileResumePlainText(raw []byte) string {
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return ""
	}
	return CompileResumePlainTextFromDoc(doc)
}

func CompileResumePlainTextFromDoc(doc map[string]any) string {
	layout := DeriveResumeLayoutFromDoc(doc)
	var sections []string

	if s := buildSkillsBlock(doc); s != "" {
		sections = append(sections, "SKILLS\n"+s)
	}
	if e := buildEducationBlock(doc); e != "" {
		sections = append(sections, "EDUCATION\n"+e)
	}
	if layout == LayoutHybrid {
		if w := buildInternshipBlock(doc); w != "" {
			sections = append(sections, "EXPERIENCE\n"+w)
		}
	}
	if p := buildProjectsBlock(doc); p != "" {
		sections = append(sections, "PROJECTS\n"+p)
	}

	compiled := strings.TrimSpace(strings.Join(sections, "\n\n"))
	uploaded := str(doc, "resumePlainText")
	if layout == LayoutEmploymentLed && uploaded != "" {
		return uploaded
	}
	if uploaded != "" && compiled != "" {
		return compiled + "\n\n--- UPLOADED RESUME ---\n\n" + uploaded
	}
	if compiled != "" {
		return compiled
	}
	return uploaded
}

// ShouldCompileResume reports whether server-side compilation should set resumePlainText.
func ShouldCompileResume(raw []byte) bool {
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return false
	}
	return ShouldCompileResumeFromDoc(doc)
}

func ShouldCompileResumeFromDoc(doc map[string]any) bool {
	layout := DeriveResumeLayoutFromDoc(doc)
	if layout == LayoutProjectOnly || layout == LayoutHybrid {
		return true
	}
	return str(doc, "resumePlainText") == ""
}

func buildSkillsBlock(doc map[string]any) string {
	var lines []string
	if v := str(doc, "skillsCoreNarrative"); v != "" {
		lines = append(lines, v)
	}
	if slugs, ok := doc["selectedToolSlugs"].([]any); ok && len(slugs) > 0 {
		var tools []string
		for _, s := range slugs {
			if t, ok := s.(string); ok && t != "" {
				tools = append(tools, t)
			}
		}
		if len(tools) > 0 {
			lines = append(lines, "Tools: "+strings.Join(tools, ", "))
		}
	}
	if v := str(doc, "toolsOtherNote"); v != "" {
		lines = append(lines, v)
	}
	return strings.Join(lines, "\n")
}

func buildEducationBlock(doc map[string]any) string {
	var lines []string
	if v := str(doc, "schoolName"); v != "" {
		line := v
		if g := str(doc, "expectedGraduation"); g != "" {
			line += " — " + g
		}
		lines = append(lines, line)
	}
	if v := str(doc, "highestEducation"); v != "" {
		lines = append(lines, "Level: "+v)
	}
	if v := str(doc, "educationDetails"); v != "" {
		lines = append(lines, v)
	}
	if v := str(doc, "courseworkNote"); v != "" {
		lines = append(lines, "Coursework: "+v)
	}
	return strings.Join(lines, "\n")
}

func buildInternshipBlock(doc map[string]any) string {
	entries, ok := doc["workEntries"].([]any)
	if !ok || len(entries) == 0 {
		return ""
	}
	var blocks []string
	for _, item := range entries {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		company := str(m, "company")
		role := str(m, "role")
		if company == "" && role == "" {
			continue
		}
		header := strings.TrimSpace(role + " — " + company)
		if d := formatDates(m); d != "" {
			header += " (" + d + ")"
		}
		var body []string
		if b := str(m, "summaryBullets"); b != "" {
			body = append(body, b)
		}
		blocks = append(blocks, header+"\n"+strings.Join(body, "\n"))
	}
	return strings.Join(blocks, "\n\n")
}

func formatDates(m map[string]any) string {
	start := str(m, "startDate")
	end := str(m, "endDate")
	if boolVal(m, "isCurrent") {
		end = "Present"
	}
	if start == "" && end == "" {
		return ""
	}
	if end == "" {
		return start
	}
	if start == "" {
		return end
	}
	return start + " – " + end
}

func buildProjectsBlock(doc map[string]any) string {
	projects, ok := doc["projects"].([]any)
	if !ok {
		return ""
	}
	var blocks []string
	for _, item := range projects {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		title := str(m, "title")
		summary := str(m, "summary")
		if title == "" && summary == "" {
			continue
		}
		var lines []string
		if title != "" {
			lines = append(lines, title)
		}
		if summary != "" {
			lines = append(lines, summary)
		}
		if t := str(m, "primaryTechSlug"); t != "" {
			lines = append(lines, "Tech: "+t)
		}
		if t := str(m, "techStackExtra"); t != "" {
			lines = append(lines, t)
		}
		if t := str(m, "impactMetrics"); t != "" {
			lines = append(lines, t)
		}
		if link := str(m, "link"); link != "" {
			lines = append(lines, "Link: "+link)
		}
		blocks = append(blocks, strings.Join(lines, "\n"))
	}
	return strings.Join(blocks, "\n\n")
}

func boolVal(m map[string]any, key string) bool {
	v, ok := m[key]
	if !ok {
		return false
	}
	b, _ := v.(bool)
	return b
}

func countCompleteProjects(doc map[string]any) int {
	projects, ok := doc["projects"].([]any)
	if !ok {
		return 0
	}
	n := 0
	for _, item := range projects {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if str(m, "title") != "" && str(m, "summary") != "" {
			n++
		}
	}
	return n
}

func workEntryComplete(m map[string]any) bool {
	return str(m, "company") != "" && str(m, "role") != ""
}

func countCompleteWorkEntries(doc map[string]any) int {
	entries, ok := doc["workEntries"].([]any)
	if !ok {
		return 0
	}
	n := 0
	for _, item := range entries {
		m, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if workEntryComplete(m) {
			n++
		}
	}
	return n
}

// NormalizeProfileJSON injects derived fields and compiled resume text before persistence.
func NormalizeProfileJSON(raw []byte) ([]byte, error) {
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		return raw, err
	}
	mode := DeriveProfileModeFromDoc(doc)
	layout := DeriveResumeLayoutFromDoc(doc)
	if str(doc, "paidWorkExperience") == "" {
		years := str(doc, "yearsExperience")
		switch {
		case isExperiencedYears(years):
			doc["paidWorkExperience"] = PaidFullTime
		case years == "0-1":
			doc["paidWorkExperience"] = PaidNone
		case years == "1-3":
			if str(doc, "honestCareerNarrative") != "" {
				doc["paidWorkExperience"] = PaidFullTime
			} else {
				doc["paidWorkExperience"] = PaidInternshipOnly
			}
		}
		layout = DeriveResumeLayoutFromDoc(doc)
		mode = DeriveProfileModeFromDoc(doc)
	}
	doc["profileMode"] = mode
	doc["resumeLayout"] = layout
	if ShouldCompileResumeFromDoc(doc) {
		if compiled := CompileResumePlainTextFromDoc(doc); compiled != "" {
			if layout != LayoutEmploymentLed || str(doc, "resumePlainText") == "" {
				doc["resumePlainText"] = compiled
			}
		}
	}
	return json.Marshal(doc)
}

// ProfileComplete mirrors frontend wizard completion for embed enqueue gating.
func ProfileComplete(raw []byte) bool {
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil || len(doc) == 0 {
		return false
	}

	mode := DeriveProfileModeFromDoc(doc)
	layout := DeriveResumeLayoutFromDoc(doc)

	if str(doc, "fullName") == "" || str(doc, "headline") == "" || str(doc, "region") == "" {
		return false
	}
	if str(doc, "yearsExperience") == "" || str(doc, "seniorityTarget") == "" || str(doc, "primaryDiscipline") == "" {
		return false
	}
	if str(doc, "paidWorkExperience") == "" {
		return false
	}

	switch mode {
	case ModeEarly:
		if str(doc, "schoolName") == "" || str(doc, "highestEducation") == "" {
			return false
		}
		if layout == LayoutHybrid && countCompleteWorkEntries(doc) < 1 {
			return false
		}
	case ModeTransitional:
		if str(doc, "honestCareerNarrative") == "" {
			return false
		}
	default:
		if str(doc, "honestCareerNarrative") == "" || str(doc, "proudestProfessionalWins") == "" {
			return false
		}
	}

	if mode == ModeExperienced && str(doc, "resumePlainText") == "" {
		return false
	}

	if str(doc, "skillsCoreNarrative") == "" {
		return false
	}
	if mode != ModeEarly && str(doc, "highestEducation") == "" {
		return false
	}
	if countCompleteProjects(doc) < MinProjectsRequired(mode) {
		return false
	}

	if mode == ModeEarly {
		if str(doc, "storyHardestTechnicalChallenge") == "" {
			return false
		}
	} else {
		if str(doc, "storyHardestTechnicalChallenge") == "" || str(doc, "storyDisagreementOrConflict") == "" {
			return false
		}
	}

	if slugs, ok := doc["selectedMotivationSlugs"].([]any); !ok || len(slugs) == 0 {
		return false
	}
	if str(doc, "workArrangement") == "" || str(doc, "visaStatus") == "" {
		return false
	}

	// Compiled resume must exist for downstream embed/match.
	if strings.TrimSpace(CompileResumePlainTextFromDoc(doc)) == "" {
		return false
	}

	return true
}

// ProfileReadyForEmbed is true after explicit profile submit with enough data to embed/match.
func ProfileReadyForEmbed(raw []byte) bool {
	if len(raw) == 0 {
		return false
	}
	var v any
	if json.Unmarshal(raw, &v) != nil {
		return false
	}
	m, ok := v.(map[string]any)
	if !ok || len(m) == 0 {
		return false
	}
	return ProfileComplete(raw)
}

// FormatWorkEntryHeader builds a display line for compiled resume output.
func FormatWorkEntryHeader(role, company, dates string) string {
	return fmt.Sprintf("%s — %s (%s)", role, company, dates)
}
