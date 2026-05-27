package tailoring

import (
	"fmt"
	"strings"
)

func buildIdentityBlock(p map[string]any) map[string]string {
	identity := map[string]string{}
	for _, key := range []string{
		"fullName", "email", "preferredName", "phoneNumber", "headline", "currentCompany", "region", "cityOrDetail",
		"timezone", "linkedInUrl", "portfolioUrl", "githubUrl", "otherLinks",
		"visaStatus", "workArrangement", "companiesYouAdmire",
		"yearsExperience", "seniorityTarget",
	} {
		if v := profileStr(p, key); v != "" {
			identity[key] = v
		}
	}
	if v, ok := p["needsVisaSponsorship"].(bool); ok && v {
		identity["needsVisaSponsorship"] = "true"
	}
	return identity
}

func collectProfileSections(profileJSON map[string]any, jd JdRequirements) []ProfileSection {
	var sections []ProfileSection
	jdTerms := append(append(append(append(append(
		append([]string{}, jd.MustHaveSkills...),
		jd.NiceToHaveSkills...),
		jd.ResponsibilityThemes...),
		jd.AtsKeywords...),
		jd.Stack...),
		jd.RoleTitleVariants...)

	add := func(key, content string) {
		content = strings.TrimSpace(content)
		if content == "" {
			return
		}
		sections = append(sections, ProfileSection{
			Key:     key,
			Content: content,
			Score:   float64(keywordOverlap(content, jdTerms)),
		})
	}

	idLines := make([]string, 0, len(buildIdentityBlock(profileJSON)))
	for k, v := range buildIdentityBlock(profileJSON) {
		idLines = append(idLines, k+": "+v)
	}
	add("identity", strings.Join(idLines, "\n"))

	if resume := profileStr(profileJSON, "resumePlainText"); resume != "" {
		add("resume", resume)
	}

	skillsParts := []string{
		profileStr(profileJSON, "skillsCoreNarrative"),
		profileStr(profileJSON, "toolsOtherNote"),
		profileStr(profileJSON, "educationDetails"),
		profileStr(profileJSON, "highestEducation"),
	}
	skillsParts = filterNonEmpty(skillsParts)
	if len(skillsParts) > 0 {
		add("skills", strings.Join(skillsParts, "\n"))
	}

	expParts := []string{
		profileStr(profileJSON, "honestCareerNarrative"),
		profileStr(profileJSON, "proudestProfessionalWins"),
		profileStr(profileJSON, "gapsOrNonTraditionalPath"),
		profileStr(profileJSON, "targetRolesNarrative"),
		profileStr(profileJSON, "whatYouWantNextNote"),
	}
	expParts = filterNonEmpty(expParts)
	if len(expParts) > 0 {
		add("experience", strings.Join(expParts, "\n\n"))
	}

	if projects, ok := profileJSON["projects"].([]any); ok {
		for i, pr := range projects {
			pm, ok := pr.(map[string]any)
			if !ok {
				continue
			}
			lines := filterNonEmpty([]string{
				strFrom(pm, "title", "Project: "),
				profileStr(pm, "summary"),
				strFrom(pm, "primaryTechSlug", "Tech: "),
				profileStr(pm, "techStackExtra"),
				profileStr(pm, "impactMetrics"),
			})
			if len(lines) > 0 {
				add("projects_"+itoa(i), strings.Join(lines, "\n"))
			}
		}
	}

	storyKeys := []string{
		"storyHardestTechnicalChallenge", "storyDisagreementOrConflict", "storyBiggestMistake",
		"storyLeadingWithoutAuthority", "storyTightDeadline", "storyConflictingPriorities",
		"storyProcessImprovement", "storyDifficultFeedback", "storyMentoringTeaching",
		"storyCrossFunctionalCollaboration", "storyAmbiguousProblem", "storyEthicalOrRiskTradeoff",
	}
	stories := filterNonEmpty(mapStrings(profileJSON, storyKeys))
	if len(stories) > 0 {
		add("stories", strings.Join(stories, "\n\n"))
	}

	soft := filterNonEmpty([]string{
		profileStr(profileJSON, "motivationsOtherNote"),
		profileStr(profileJSON, "companiesYouAdmire"),
	})
	if len(soft) > 0 {
		add("preferences_soft", strings.Join(soft, "\n"))
	}

	sortSectionsByScore(sections)
	return sections
}

func findEvidence(sections []ProfileSection, requirement string) []struct {
	SourceField    string
	Excerpt        string
	RelevanceScore float64
} {
	reqLower := strings.ToLower(requirement)
	prefixLen := 12
	if len(reqLower) < prefixLen {
		prefixLen = len(reqLower)
	}
	reqPrefix := reqLower[:prefixLen]

	var out []struct {
		SourceField    string
		Excerpt        string
		RelevanceScore float64
	}

	for _, sec := range sections {
		contentLower := strings.ToLower(sec.Content)
		if !strings.Contains(contentLower, reqPrefix) {
			words := strings.Fields(reqLower)
			hits := 0
			for _, w := range words {
				if len(w) > 3 && strings.Contains(contentLower, w) {
					hits++
				}
			}
			if hits == 0 {
				continue
			}
		}
		idx := strings.Index(contentLower, reqPrefix[:min(8, len(reqPrefix))])
		start := 0
		if idx >= 0 {
			start = max(0, idx-40)
		}
		end := min(len(sec.Content), start+200)
		excerpt := strings.TrimSpace(sec.Content[start:end])
		score := sec.Score + 1
		if idx >= 0 {
			score = sec.Score + 2
		}
		out = append(out, struct {
			SourceField    string
			Excerpt        string
			RelevanceScore float64
		}{sec.Key, excerpt, score})
	}

	sortEvidence(out)
	if len(out) > 3 {
		out = out[:3]
	}
	return out
}

func BuildEvidenceMap(profileJSON map[string]any, jd JdRequirements, embeddingSections []ProfileSection) EvidenceMap {
	profileSections := collectProfileSections(profileJSON, jd)
	for _, chunk := range embeddingSections {
		found := false
		for i := range profileSections {
			if profileSections[i].Key == chunk.Key {
				profileSections[i].Score += chunk.Score * 5
				found = true
				break
			}
		}
		if !found {
			profileSections = append(profileSections, ProfileSection{
				Key:     chunk.Key,
				Content: chunk.Content,
				Score:   chunk.Score * 5,
			})
		}
	}
	sortSectionsByScore(profileSections)

	var items []EvidenceItem
	addItems := func(reqs []string, typ string) {
		for _, req := range reqs {
			req = strings.TrimSpace(req)
			if req == "" {
				continue
			}
			ev := findEvidence(profileSections, req)
			evList := make([]struct {
				SourceField    string  `json:"sourceField"`
				Excerpt        string  `json:"excerpt"`
				RelevanceScore float64 `json:"relevanceScore"`
			}, len(ev))
			for i, e := range ev {
				evList[i].SourceField = e.SourceField
				evList[i].Excerpt = e.Excerpt
				evList[i].RelevanceScore = e.RelevanceScore
			}
			items = append(items, EvidenceItem{
				Requirement:     req,
				RequirementType: typ,
				Evidence:        evList,
			})
		}
	}
	addItems(jd.MustHaveSkills, "must_have")
	addItems(jd.NiceToHaveSkills, "nice_to_have")
	addItems(jd.ResponsibilityThemes, "theme")
	keywords := jd.AtsKeywords
	if len(keywords) > 15 {
		keywords = keywords[:15]
	}
	addItems(keywords, "keyword")

	limit := 20
	if len(profileSections) > limit {
		profileSections = profileSections[:limit]
	}

	return EvidenceMap{
		Identity:        buildIdentityBlock(profileJSON),
		Items:           items,
		ProfileSections: profileSections,
		DensityHints:    buildResumeDensityHints(profileJSON),
		ExpandFrom:      collectExpandFieldHints(profileJSON),
	}
}

func filterNonEmpty(ss []string) []string {
	var out []string
	for _, s := range ss {
		if strings.TrimSpace(s) != "" {
			out = append(out, strings.TrimSpace(s))
		}
	}
	return out
}

func mapStrings(p map[string]any, keys []string) []string {
	var out []string
	for _, k := range keys {
		if s := profileStr(p, k); s != "" {
			out = append(out, s)
		}
	}
	return out
}

func strFrom(m map[string]any, key, prefix string) string {
	v := profileStr(m, key)
	if v == "" {
		return ""
	}
	return prefix + v
}

func itoa(i int) string {
	return fmt.Sprintf("%d", i)
}

func sortSectionsByScore(sections []ProfileSection) {
	for i := 0; i < len(sections); i++ {
		for j := i + 1; j < len(sections); j++ {
			if sections[j].Score > sections[i].Score {
				sections[i], sections[j] = sections[j], sections[i]
			}
		}
	}
}

func sortEvidence(out []struct {
	SourceField    string
	Excerpt        string
	RelevanceScore float64
}) {
	for i := 0; i < len(out); i++ {
		for j := i + 1; j < len(out); j++ {
			if out[j].RelevanceScore > out[i].RelevanceScore {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
