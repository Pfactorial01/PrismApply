package matching

// UserPreferences is the normalized hard/soft preference view used for gating and scoring.
type UserPreferences struct {
	WorkArrangement         string   `json:"workArrangement"`
	Region                  string   `json:"region"`
	Timezone                string   `json:"timezone"`
	NeedsVisaSponsorship    bool     `json:"needsVisaSponsorship"`
	VisaStatus              string   `json:"visaStatus"`
	SeniorityTarget         string   `json:"seniorityTarget"`
	YearsExperience         string   `json:"yearsExperience"`
	PrimaryDiscipline       string   `json:"primaryDiscipline"`
	CompensationBand        string   `json:"compensationBand"`
	OpenToContract          bool     `json:"openToContract"`
	OpenToRelocate          bool     `json:"openToRelocate"`
	DealbreakerSlugs        []string `json:"dealbreakerSlugs"`
	DealbreakersOtherNote   string   `json:"dealbreakersOtherNote"`
	IndustrySlugs           []string `json:"industrySlugs"`
	DealbreakerLabels       []string `json:"dealbreakerLabels"`
	HardPreferenceBullets   []string `json:"hardPreferenceBullets"`
	// MatchTierMode controls which match tiers create job_matches: strong_only or strong_and_promising.
	MatchTierMode string `json:"matchTierMode,omitempty"`
}

// JobFacts is structured metadata extracted once at job ingest.
type JobFacts struct {
	RemotePolicy        string   `json:"remotePolicy"`
	EmploymentType      string   `json:"employmentType"`
	SeniorityLevel      string   `json:"seniorityLevel"`
	RequiresSponsorship *bool    `json:"requiresSponsorship,omitempty"`
	IndustryTags        []string `json:"industryTags"`
	HasHeavyOncall      bool     `json:"hasHeavyOncall"`
	SalaryMinUSD          *int     `json:"salaryMinUsd,omitempty"`
	SalaryMaxUSD          *int     `json:"salaryMaxUsd,omitempty"`
	LocationText        string   `json:"locationText"`
	Title               string   `json:"title"`
	Company             string   `json:"company"`
}

// GateResult is the outcome of Layer 1 hard preference checks.
type GateResult struct {
	OK      bool     `json:"ok"`
	Reasons []string `json:"reasons,omitempty"`
}

// ProfileSection is one embeddable slice of profile content.
type ProfileSection struct {
	Key     string
	Content string
}

// ScoreBreakdown holds per-dimension semantic scores (Layer 2).
type ScoreBreakdown struct {
	ResumePosting   float64 `json:"resumePosting"`
	SkillsReqs      float64 `json:"skillsReqs"`
	TargetsPosting  float64 `json:"targetsPosting"`
	ExperienceDesc  float64 `json:"experienceDesc"`
	MaxChunkSim     float64 `json:"maxChunkSim"`
	MatchedChunks   int     `json:"matchedChunks"`
	FinalScore      float64 `json:"finalScore"`
}

// AdjudicationResult is Layer 3 LLM output (stored on job_matches).
type AdjudicationResult struct {
	Recommend            bool     `json:"recommend"`
	FitScore             int      `json:"fitScore"`
	PreferenceViolations []string `json:"preferenceViolations"`
	Strengths            []string `json:"strengths"`
	Gaps                 []string `json:"gaps"`
	SeniorityFit         string   `json:"seniorityFit"`
}
