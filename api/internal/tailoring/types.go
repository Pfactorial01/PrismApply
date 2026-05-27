package tailoring

import "prismapply/api/internal/matching"

type FormFieldRow struct {
	Label     string   `json:"label"`
	FieldType string   `json:"field_type"`
	Required  bool     `json:"required"`
	Options   []string `json:"options"`
	Position  int      `json:"position"`
}

type SourceRef struct {
	Field   string `json:"field"`
	Excerpt string `json:"excerpt"`
}

type ResumeBullet struct {
	Text       string      `json:"text"`
	SourceRefs []SourceRef `json:"sourceRefs"`
}

type ResumeExperience struct {
	Company  string         `json:"company"`
	Role     string         `json:"role"`
	Location string         `json:"location,omitempty"`
	Dates    string         `json:"dates,omitempty"`
	Bullets  []ResumeBullet `json:"bullets"`
}

type ResumeProject struct {
	Title   string         `json:"title"`
	Bullets []ResumeBullet `json:"bullets"`
}

type StructuredResume struct {
	Name       string              `json:"name"`
	Contact    []string            `json:"contact"`
	Summary    string              `json:"summary,omitempty"`
	Skills     []SkillCategory     `json:"skills"`
	Experience []ResumeExperience  `json:"experience"`
	Projects   []ResumeProject     `json:"projects,omitempty"`
	Education  []string            `json:"education,omitempty"`
}

type SkillCategory struct {
	Category string   `json:"category"`
	Items    []string `json:"items"`
}

type JdRequirements struct {
	RoleTitleVariants    []string `json:"roleTitleVariants"`
	Seniority            string   `json:"seniority"`
	LocationPolicy       string   `json:"locationPolicy"`
	MustHaveSkills       []string `json:"mustHaveSkills"`
	NiceToHaveSkills     []string `json:"niceToHaveSkills"`
	ResponsibilityThemes []string `json:"responsibilityThemes"`
	AtsKeywords          []string `json:"atsKeywords"`
	Stack                []string `json:"stack"`
}

type EvidenceItem struct {
	Requirement     string `json:"requirement"`
	RequirementType string `json:"requirementType"`
	Evidence        []struct {
		SourceField     string  `json:"sourceField"`
		Excerpt         string  `json:"excerpt"`
		RelevanceScore  float64 `json:"relevanceScore"`
	} `json:"evidence"`
}

type ProfileSection struct {
	Key     string  `json:"key"`
	Content string  `json:"content"`
	Score   float64 `json:"score,omitempty"`
}

type EvidenceMap struct {
	Identity        map[string]string `json:"identity"`
	Items           []EvidenceItem    `json:"items"`
	ProfileSections []ProfileSection  `json:"profileSections"`
	DensityHints    ResumeDensityHints
	ExpandFrom      []ExpandFieldHint
}

type ResumeTemplateID string

const (
	TemplateClassic ResumeTemplateID = "classic"
	TemplateModern  ResumeTemplateID = "modern"
	TemplateCompact ResumeTemplateID = "compact"
	TemplateMinimal ResumeTemplateID = "minimal"
	TemplateATS     ResumeTemplateID = "ats"
)

type FieldClass string

const (
	FieldIdentity         FieldClass = "identity"
	FieldFile             FieldClass = "file"
	FieldCoverLetter      FieldClass = "cover_letter"
	FieldCoverLetterText  FieldClass = "cover_letter_text"
	FieldSelect           FieldClass = "select"
	FieldLocation  FieldClass = "location"
	FieldShortText FieldClass = "short_text"
	FieldLongText  FieldClass = "long_text"
	FieldBehavior  FieldClass = "behavioral"
	FieldEEO       FieldClass = "eeo"
)

type ClassifiedField struct {
	FormFieldRow
	FieldClass FieldClass `json:"fieldClass"`
}

type FormFieldAnswer struct {
	Label         string      `json:"label"`
	Value         string      `json:"value"`
	LowConfidence bool        `json:"lowConfidence,omitempty"`
	SourceRefs    []SourceRef `json:"sourceRefs,omitempty"`
}

type TailorMetadata struct {
	CitedFields         []string         `json:"citedFields"`
	TemplateID          ResumeTemplateID `json:"templateId"`
	LowConfidenceFields []string         `json:"lowConfidenceFields"`
	ValidationWarnings  []string         `json:"validationWarnings"`
}

type TailorContext struct {
	MatchID           int64
	UserID            string
	JobID             string
	JobTitle          string
	JobCompany        string
	JobLocation       string
	JobDescription    string
	JobSeniorityLevel string
	JobFacts          matching.JobFacts
	FormFields        []FormFieldRow
	ProfileJSON       map[string]any
	Prefs             matching.UserPreferences
}

type PipelineResult struct {
	StructuredResume     StructuredResume
	PlainTextResume      string
	CoverLetter          string
	CoverLetterFilename  string
	CoverLetterPDFURL    string
	FormAnswers          []FormFieldAnswer
	TemplateID           ResumeTemplateID
	ResumeFilename       string
	Metadata             TailorMetadata
}

type ValidationResult struct {
	OK          bool
	Warnings    []string
	CitedFields []string
}

type CoverLetterResult struct {
	CoverLetter string
	CitedFields []string
}
