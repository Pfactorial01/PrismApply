package tailoring

import (
	"fmt"
	"strings"

	"prismapply/api/internal/profilemode"
)

const (
	minBulletsMostRecentRole = 4
	minBulletsOtherRole      = 2
	minBulletsPerProject     = 2
)

// ResumeDensityHints guides the resume writer toward appropriate length without inventing facts.
type ResumeDensityHints struct {
	PageTarget           string
	ResumeLayout         string
	SeniorityTarget      string
	YearsExperience      string
	MinBulletsMostRecent int
	MinBulletsOtherRole  int
	MinBulletsPerProject int
}

// ExpandFieldHint points the writer at profile fields that can yield additional factual bullets.
type ExpandFieldHint struct {
	Field   string
	Content string
}

func buildResumeDensityHints(profile map[string]any) ResumeDensityHints {
	seniority := profileStr(profile, "seniorityTarget")
	years := profileStr(profile, "yearsExperience")
	layout := profileStr(profile, "resumeLayout")
	if layout == "" {
		layout = profilemode.DeriveResumeLayoutFromDoc(profile)
	}
	page := "1 page"
	if layout == profilemode.LayoutEmploymentLed && isExtendedResumeSeniority(seniority, years) {
		page = "2 pages maximum"
	}

	minRecent := minBulletsMostRecentRole
	minOther := minBulletsOtherRole
	minProject := minBulletsPerProject
	switch layout {
	case profilemode.LayoutProjectOnly:
		minRecent = 0
		minOther = 0
		minProject = 3
	case profilemode.LayoutHybrid:
		minRecent = 2
		minOther = 2
		minProject = 3
	}

	return ResumeDensityHints{
		PageTarget:           page,
		ResumeLayout:         layout,
		SeniorityTarget:      seniority,
		YearsExperience:      years,
		MinBulletsMostRecent: minRecent,
		MinBulletsOtherRole:  minOther,
		MinBulletsPerProject: minProject,
	}
}

func isExtendedResumeSeniority(seniority, years string) bool {
	switch seniority {
	case "staff", "principal", "director", "lead":
		return true
	}
	switch years {
	case "8-12", "12+":
		return true
	}
	return false
}

func collectExpandFieldHints(profile map[string]any) []ExpandFieldHint {
	var hints []ExpandFieldHint
	add := func(field, content string) {
		content = strings.TrimSpace(content)
		if content == "" {
			return
		}
		if len(content) > 1200 {
			content = content[:1200] + "…"
		}
		hints = append(hints, ExpandFieldHint{Field: field, Content: content})
	}

	add("proudestProfessionalWins", profileStr(profile, "proudestProfessionalWins"))
	add("honestCareerNarrative", profileStr(profile, "honestCareerNarrative"))

	storyKeys := []string{
		"storyHardestTechnicalChallenge", "storyDisagreementOrConflict", "storyBiggestMistake",
		"storyLeadingWithoutAuthority", "storyTightDeadline", "storyConflictingPriorities",
		"storyProcessImprovement", "storyDifficultFeedback", "storyMentoringTeaching",
		"storyCrossFunctionalCollaboration", "storyAmbiguousProblem", "storyEthicalOrRiskTradeoff",
	}
	for _, key := range storyKeys {
		add(key, profileStr(profile, key))
	}

	if projects, ok := profile["projects"].([]any); ok {
		for i, pr := range projects {
			pm, ok := pr.(map[string]any)
			if !ok {
				continue
			}
			title := profileStr(pm, "title")
			parts := filterNonEmpty([]string{
				profileStr(pm, "summary"),
				profileStr(pm, "impactMetrics"),
				profileStr(pm, "techStackExtra"),
			})
			if len(parts) == 0 {
				continue
			}
			field := fmt.Sprintf("projects[%d]", i)
			if title != "" {
				field = fmt.Sprintf("projects[%d].%s", i, title)
			}
			add(field, strings.Join(parts, "\n"))
		}
	}

	if entries, ok := profile["workEntries"].([]any); ok {
		for i, item := range entries {
			m, ok := item.(map[string]any)
			if !ok {
				continue
			}
			parts := filterNonEmpty([]string{
				strFrom(m, "role", "Role: "),
				strFrom(m, "company", "Company: "),
				profileStr(m, "summaryBullets"),
			})
			if len(parts) == 0 {
				continue
			}
			add(fmt.Sprintf("workEntries[%d]", i), strings.Join(parts, "\n"))
		}
	}
	return hints
}

func formatDensityHintsBlock(h ResumeDensityHints) string {
	layoutNote := ""
	switch h.ResumeLayout {
	case profilemode.LayoutProjectOnly:
		layoutNote = "Layout: project_only — Skills, Education, Projects only. experience[] must be empty. Do not invent employers."
	case profilemode.LayoutHybrid:
		layoutNote = "Layout: hybrid — Skills, Education, short internship Experience block (from workEntries only), then Projects."
	default:
		layoutNote = "Layout: employment_led — standard Experience then Projects."
	}
	return fmt.Sprintf(`%s
Page target: %s
Applicant seniority: %s
Years experience: %s
Minimum bullets — most recent role: %d; other roles: %d; each included project: %d
Fill the page target using profile-backed detail. Do not pad with generic filler or invented metrics.`,
		layoutNote,
		h.PageTarget,
		orDefault(h.SeniorityTarget, "unspecified"),
		orDefault(h.YearsExperience, "unspecified"),
		h.MinBulletsMostRecent,
		h.MinBulletsOtherRole,
		h.MinBulletsPerProject,
	)
}

func formatExpandHintsBlock(hints []ExpandFieldHint) string {
	if len(hints) == 0 {
		return "(none — use resume and experience sections only)"
	}
	var b strings.Builder
	for _, h := range hints {
		b.WriteString("### ")
		b.WriteString(h.Field)
		b.WriteString("\n")
		b.WriteString(h.Content)
		b.WriteString("\n\n")
	}
	return strings.TrimSpace(b.String())
}
