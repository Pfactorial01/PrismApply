package matching

import (
	"encoding/json"
	"fmt"
	"strings"

	"prismapply/api/internal/embeddings"
)

// Section keys for profile embedding chunks.
const (
	SectionIdentity       = "identity"
	SectionTargets        = "targets"
	SectionResume         = "resume"
	SectionSkills         = "skills"
	SectionExperience     = "experience"
	SectionProjects       = "projects"
	SectionStories        = "stories"
	SectionPreferencesSoft = "preferences_soft"
	SectionConstraints    = "constraints"
)

// Job section keys for job_embedding_sections.
const (
	JobSectionPostingCore = "posting_core"
	JobSectionRequirements = "requirements"
	JobSectionLogistics     = "logistics"
	JobSectionFormFields    = "form_fields"
)

// Default matching thresholds (Layer 2).
const (
	ChunkSimilarityThreshold = 0.55
	MinMatchedChunks         = 2
	FinalScoreFloor          = 0.55
)

// Score weights for Layer 2 composite score.
const (
	WeightResumePosting  = 0.35
	WeightSkillsReqs     = 0.20
	WeightTargetsPosting = 0.15
	WeightExperienceDesc = 0.15
	WeightMaxChunk       = 0.15
)

type fullProfile struct {
	FullName                  string        `json:"fullName"`
	PreferredName             string        `json:"preferredName"`
	Headline                  string        `json:"headline"`
	LinkedInUrl               string        `json:"linkedInUrl"`
	PortfolioUrl              string        `json:"portfolioUrl"`
	GithubUrl                 string        `json:"githubUrl"`
	OtherLinks                string        `json:"otherLinks"`
	YearsExperience           string        `json:"yearsExperience"`
	SeniorityTarget           string        `json:"seniorityTarget"`
	PrimaryDiscipline         string        `json:"primaryDiscipline"`
	DisciplineOtherNote       string        `json:"disciplineOtherNote"`
	TargetRolesNarrative      string        `json:"targetRolesNarrative"`
	SelectedIndustrySlugs     []string      `json:"selectedIndustrySlugs"`
	IndustryOtherNote         string        `json:"industryOtherNote"`
	ResumePlainText           string        `json:"resumePlainText"`
	SkillsCoreNarrative       string        `json:"skillsCoreNarrative"`
	SelectedToolSlugs         []string      `json:"selectedToolSlugs"`
	SelectedRampAreaSlugs     []string      `json:"selectedRampAreaSlugs"`
	ToolsOtherNote            string        `json:"toolsOtherNote"`
	HighestEducation          string        `json:"highestEducation"`
	EducationDetails          string        `json:"educationDetails"`
	HonestCareerNarrative     string        `json:"honestCareerNarrative"`
	ProudestProfessionalWins  string        `json:"proudestProfessionalWins"`
	GapsOrNonTraditionalPath  string        `json:"gapsOrNonTraditionalPath"`
	Projects                  []projectJSON `json:"projects"`
	SelectedMotivationSlugs   []string      `json:"selectedMotivationSlugs"`
	MotivationsOtherNote      string        `json:"motivationsOtherNote"`
	SelectedNextRoleDesireSlugs []string    `json:"selectedNextRoleDesireSlugs"`
	WhatYouWantNextNote       string        `json:"whatYouWantNextNote"`
	SelectedDealbreakerSlugs  []string      `json:"selectedDealbreakerSlugs"`
	DealBreakersOtherNote     string        `json:"dealBreakersOtherNote"`
	StoryHardestTechnicalChallenge string   `json:"storyHardestTechnicalChallenge"`
	StoryDisagreementOrConflict    string   `json:"storyDisagreementOrConflict"`
	StoryBiggestMistake              string   `json:"storyBiggestMistake"`
}

type projectJSON struct {
	Title           string `json:"title"`
	Summary         string `json:"summary"`
	PrimaryTechSlug string `json:"primaryTechSlug"`
	TechStackExtra  string `json:"techStackExtra"`
	ImpactMetrics   string `json:"impactMetrics"`
}

// BuildProfileSections returns section-keyed text for embedding (constraints excluded from similarity).
func BuildProfileSections(raw []byte) []ProfileSection {
	var p fullProfile
	if err := json.Unmarshal(raw, &p); err != nil {
		legacy := embeddings.ProfileJSONToEmbedInput(raw)
		if legacy == "" {
			return nil
		}
		return chunkLegacy(legacy)
	}

	prefs := BuildUserPreferences(raw)
	var sections []ProfileSection

	if id := buildIdentitySection(p); id != "" {
		sections = append(sections, ProfileSection{Key: SectionIdentity, Content: id})
	}
	if t := buildTargetsSection(p); t != "" {
		sections = append(sections, ProfileSection{Key: SectionTargets, Content: t})
	}
	if p.ResumePlainText != "" {
		for i, chunk := range embeddings.ChunkRunes(p.ResumePlainText, embeddings.DefaultChunkRunes, embeddings.DefaultOverlapRunes) {
			key := SectionResume
			if i > 0 {
				key = fmt.Sprintf("%s_%d", SectionResume, i)
			}
			sections = append(sections, ProfileSection{Key: key, Content: chunk})
		}
	}
	if s := buildSkillsSection(p); s != "" {
		sections = append(sections, ProfileSection{Key: SectionSkills, Content: s})
	}
	if e := buildExperienceSection(p); e != "" {
		sections = append(sections, ProfileSection{Key: SectionExperience, Content: e})
	}
	for i, proj := range buildProjectSections(p.Projects) {
		sections = append(sections, ProfileSection{Key: fmt.Sprintf("%s_%d", SectionProjects, i), Content: proj})
	}
	if st := buildStoriesSection(p); st != "" {
		sections = append(sections, ProfileSection{Key: SectionStories, Content: st})
	}
	if soft := buildSoftPreferencesSection(p); soft != "" {
		sections = append(sections, ProfileSection{Key: SectionPreferencesSoft, Content: soft})
	}
	if c := buildConstraintsSection(prefs); c != "" {
		sections = append(sections, ProfileSection{Key: SectionConstraints, Content: c})
	}

	if len(sections) == 0 {
		legacy := embeddings.ProfileJSONToEmbedInput(raw)
		if legacy != "" {
			return chunkLegacy(legacy)
		}
	}
	return sections
}

func chunkLegacy(s string) []ProfileSection {
	chunks := embeddings.ChunkRunes(s, embeddings.DefaultChunkRunes, embeddings.DefaultOverlapRunes)
	out := make([]ProfileSection, len(chunks))
	for i, c := range chunks {
		key := "legacy"
		if i > 0 {
			key = fmt.Sprintf("legacy_%d", i)
		}
		out[i] = ProfileSection{Key: key, Content: c}
	}
	return out
}

func buildIdentitySection(p fullProfile) string {
	var lines []string
	if n := strings.TrimSpace(p.FullName); n != "" {
		lines = append(lines, "Name: "+n)
	}
	if n := strings.TrimSpace(p.PreferredName); n != "" {
		lines = append(lines, "Preferred name: "+n)
	}
	if h := strings.TrimSpace(p.Headline); h != "" {
		lines = append(lines, "Headline: "+h)
	}
	for _, link := range []string{p.LinkedInUrl, p.PortfolioUrl, p.GithubUrl, p.OtherLinks} {
		if strings.TrimSpace(link) != "" {
			lines = append(lines, "Link: "+link)
		}
	}
	return strings.Join(lines, "\n")
}

func buildTargetsSection(p fullProfile) string {
	var lines []string
	if p.SeniorityTarget != "" {
		lines = append(lines, "Minimum seniority: "+labelForSlug(p.SeniorityTarget)+" (roles at or above this level are acceptable)")
	}
	if p.YearsExperience != "" {
		lines = append(lines, "Years experience: "+p.YearsExperience)
	}
	if p.PrimaryDiscipline != "" {
		lines = append(lines, "Discipline: "+labelForSlug(p.PrimaryDiscipline))
		if p.DisciplineOtherNote != "" {
			lines = append(lines, p.DisciplineOtherNote)
		}
	}
	if p.TargetRolesNarrative != "" {
		lines = append(lines, "Target roles: "+p.TargetRolesNarrative)
	}
	if len(p.SelectedIndustrySlugs) > 0 {
		var ind []string
		for _, s := range p.SelectedIndustrySlugs {
			ind = append(ind, labelForSlug(s))
		}
		lines = append(lines, "Industries: "+strings.Join(ind, ", "))
	}
	if p.IndustryOtherNote != "" {
		lines = append(lines, p.IndustryOtherNote)
	}
	return strings.Join(lines, "\n")
}

func buildSkillsSection(p fullProfile) string {
	var lines []string
	if p.SkillsCoreNarrative != "" {
		lines = append(lines, p.SkillsCoreNarrative)
	}
	if len(p.SelectedToolSlugs) > 0 {
		var tools []string
		for _, s := range p.SelectedToolSlugs {
			tools = append(tools, labelForSlug(s))
		}
		lines = append(lines, "Tools: "+strings.Join(tools, ", "))
	}
	if len(p.SelectedRampAreaSlugs) > 0 {
		var ramp []string
		for _, s := range p.SelectedRampAreaSlugs {
			ramp = append(ramp, labelForSlug(s))
		}
		lines = append(lines, "Ramp areas: "+strings.Join(ramp, ", "))
	}
	if p.ToolsOtherNote != "" {
		lines = append(lines, p.ToolsOtherNote)
	}
	if p.HighestEducation != "" {
		lines = append(lines, "Education: "+labelForSlug(p.HighestEducation))
	}
	if p.EducationDetails != "" {
		lines = append(lines, p.EducationDetails)
	}
	return strings.Join(lines, "\n")
}

func buildExperienceSection(p fullProfile) string {
	var parts []string
	for _, s := range []string{p.HonestCareerNarrative, p.ProudestProfessionalWins, p.GapsOrNonTraditionalPath} {
		if strings.TrimSpace(s) != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, "\n\n")
}

func buildProjectSections(projects []projectJSON) []string {
	var out []string
	for _, pr := range projects {
		if strings.TrimSpace(pr.Title) == "" && strings.TrimSpace(pr.Summary) == "" {
			continue
		}
		var lines []string
		if pr.Title != "" {
			lines = append(lines, "Project: "+pr.Title)
		}
		if pr.Summary != "" {
			lines = append(lines, pr.Summary)
		}
		if pr.PrimaryTechSlug != "" {
			lines = append(lines, "Tech: "+labelForSlug(pr.PrimaryTechSlug))
		}
		if pr.TechStackExtra != "" {
			lines = append(lines, pr.TechStackExtra)
		}
		if pr.ImpactMetrics != "" {
			lines = append(lines, pr.ImpactMetrics)
		}
		out = append(out, strings.Join(lines, "\n"))
	}
	return out
}

func buildStoriesSection(p fullProfile) string {
	var parts []string
	for _, s := range []string{
		p.StoryHardestTechnicalChallenge, p.StoryDisagreementOrConflict, p.StoryBiggestMistake,
	} {
		if strings.TrimSpace(s) != "" {
			parts = append(parts, s)
		}
	}
	return strings.Join(parts, "\n\n")
}

func buildSoftPreferencesSection(p fullProfile) string {
	var lines []string
	if len(p.SelectedMotivationSlugs) > 0 {
		var m []string
		for _, s := range p.SelectedMotivationSlugs {
			m = append(m, labelForSlug(s))
		}
		lines = append(lines, "Motivations: "+strings.Join(m, ", "))
	}
	if p.MotivationsOtherNote != "" {
		lines = append(lines, p.MotivationsOtherNote)
	}
	if len(p.SelectedNextRoleDesireSlugs) > 0 {
		var n []string
		for _, s := range p.SelectedNextRoleDesireSlugs {
			n = append(n, labelForSlug(s))
		}
		lines = append(lines, "Next role desires: "+strings.Join(n, ", "))
	}
	if p.WhatYouWantNextNote != "" {
		lines = append(lines, p.WhatYouWantNextNote)
	}
	return strings.Join(lines, "\n")
}

func buildConstraintsSection(prefs UserPreferences) string {
	if len(prefs.HardPreferenceBullets) == 0 {
		return ""
	}
	return "Hard preferences and dealbreakers:\n" + strings.Join(prefs.HardPreferenceBullets, "\n")
}

// BuildJobSections returns section texts for job embedding.
func BuildJobSections(title, company, location, description string, formLabels []string, facts JobFacts) []ProfileSection {
	posting := strings.TrimSpace(strings.Join([]string{
		"Title: " + title,
		"Company: " + company,
		ifStr(location, "Location: "+location),
		description,
	}, "\n"))
	reqs := extractRequirementsBlock(description)
	logistics := buildLogisticsSection(facts, location)
	formText := ""
	if len(formLabels) > 0 {
		formText = "Application form fields:\n" + strings.Join(formLabels, "\n")
	}
	var out []ProfileSection
	if posting != "" {
		out = append(out, ProfileSection{Key: JobSectionPostingCore, Content: posting})
	}
	if reqs != "" {
		out = append(out, ProfileSection{Key: JobSectionRequirements, Content: reqs})
	}
	if logistics != "" {
		out = append(out, ProfileSection{Key: JobSectionLogistics, Content: logistics})
	}
	if formText != "" {
		out = append(out, ProfileSection{Key: JobSectionFormFields, Content: formText})
	}
	return out
}

func ifStr(s, prefix string) string {
	if strings.TrimSpace(s) == "" {
		return ""
	}
	return prefix
}

func extractRequirementsBlock(desc string) string {
	if desc == "" {
		return ""
	}
	lower := strings.ToLower(desc)
	startMarkers := []string{
		"required qualifications",
		"preferred qualifications",
		"minimum qualifications",
		"basic qualifications",
		"requirements:",
		"qualifications:",
		"what you'll do",
		"what you’ll do",
		"what you'll need",
		"what we're looking for",
		"you have:",
		"you will:",
	}
	stopMarkers := []string{
		"us salary range",
		"salary range",
		"benefits at ",
		"protecting yourself from recruitment scams",
		"data privacy",
		"by submitting your application",
	}

	start := -1
	for _, m := range startMarkers {
		if i := strings.Index(lower, m); i >= 0 && (start < 0 || i < start) {
			start = i
		}
	}
	if start < 0 {
		// fallback: last 40% often lists reqs
		if len(desc) > 500 {
			return strings.TrimSpace(desc[len(desc)*3/5:])
		}
		return desc
	}

	end := len(desc)
	segmentLower := strings.ToLower(desc[start:])
	for _, m := range stopMarkers {
		if i := strings.Index(segmentLower, m); i >= 0 && start+i < end {
			end = start + i
		}
	}
	return strings.TrimSpace(desc[start:end])
}

func buildLogisticsSection(facts JobFacts, location string) string {
	var lines []string
	if facts.RemotePolicy != "" && facts.RemotePolicy != "unknown" {
		lines = append(lines, "Work model: "+facts.RemotePolicy)
	}
	if facts.EmploymentType != "" {
		lines = append(lines, "Employment: "+facts.EmploymentType)
	}
	if facts.SeniorityLevel != "" && facts.SeniorityLevel != "unknown" {
		lines = append(lines, "Seniority: "+facts.SeniorityLevel)
	}
	if facts.RequiresSponsorship != nil {
		if *facts.RequiresSponsorship {
			lines = append(lines, "Visa sponsorship available")
		} else {
			lines = append(lines, "No visa sponsorship")
		}
	}
	if facts.HasHeavyOncall {
		lines = append(lines, "Heavy on-call expected")
	}
	if len(facts.IndustryTags) > 0 {
		lines = append(lines, "Industry signals: "+strings.Join(facts.IndustryTags, ", "))
	}
	if location != "" {
		lines = append(lines, "Location: "+location)
	}
	return strings.Join(lines, "\n")
}

// ComputeFinalScore combines dimension similarities into a weighted score.
func ComputeFinalScore(b *ScoreBreakdown) float64 {
	b.FinalScore = WeightResumePosting*b.ResumePosting +
		WeightSkillsReqs*b.SkillsReqs +
		WeightTargetsPosting*b.TargetsPosting +
		WeightExperienceDesc*b.ExperienceDesc +
		WeightMaxChunk*b.MaxChunkSim
	return b.FinalScore
}

// SectionPrefixMatch returns true if section key starts with the given prefix.
func SectionPrefixMatch(sectionKey, prefix string) bool {
	return sectionKey == prefix || strings.HasPrefix(sectionKey, prefix+"_")
}
