package tailoring

import (
	"fmt"
	"strings"
)

const (
	minBulletsMostRecentRole = 4
	minBulletsOtherRole      = 2
	minBulletsPerProject     = 2
)

// ResumeDensityHints guides the resume writer toward appropriate length without inventing facts.
type ResumeDensityHints struct {
	PageTarget           string
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
	page := "1 page"
	if isExtendedResumeSeniority(seniority, years) {
		page = "2 pages maximum"
	}
	return ResumeDensityHints{
		PageTarget:           page,
		SeniorityTarget:      seniority,
		YearsExperience:      years,
		MinBulletsMostRecent: minBulletsMostRecentRole,
		MinBulletsOtherRole:  minBulletsOtherRole,
		MinBulletsPerProject: minBulletsPerProject,
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
	return hints
}

func formatDensityHintsBlock(h ResumeDensityHints) string {
	return fmt.Sprintf(`Page target: %s
Applicant seniority: %s
Years experience: %s
Minimum bullets — most recent role: %d; other roles: %d; each included project: %d
Fill the page target using profile-backed detail. Do not pad with generic filler or invented metrics.`,
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
