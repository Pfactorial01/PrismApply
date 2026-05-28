package profilemode

import (
	"encoding/json"
	"strings"
)

const (
	ModeEarly         = "early"
	ModeTransitional  = "transitional"
	ModeExperienced   = "experienced"

	LayoutProjectOnly   = "project_only"
	LayoutHybrid        = "hybrid"
	LayoutEmploymentLed = "employment_led"

	PaidNone           = "none"
	PaidInternshipOnly = "internship_only"
	PaidFullTime       = "full_time"
)

// DeriveProfileMode classifies the applicant from targets fields.
func DeriveProfileMode(raw []byte) string {
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return ModeExperienced
	}
	return DeriveProfileModeFromDoc(doc)
}

func DeriveProfileModeFromDoc(doc map[string]any) string {
	years := str(doc, "yearsExperience")
	seniority := str(doc, "seniorityTarget")
	paid := str(doc, "paidWorkExperience")

	if paid == PaidFullTime || isExperiencedYears(years) {
		return ModeExperienced
	}
	if isSeniorExperienced(seniority) && years != "0-1" && years != "" {
		return ModeExperienced
	}
	if years == "1-3" {
		return ModeTransitional
	}
	if years == "0-1" || years == "" {
		if paid != PaidFullTime {
			return ModeEarly
		}
	}
	if paid == PaidNone || paid == PaidInternshipOnly {
		return ModeEarly
	}
	return ModeTransitional
}

// DeriveResumeLayout selects tailored resume structure from targets.
func DeriveResumeLayout(raw []byte) string {
	var doc map[string]any
	if json.Unmarshal(raw, &doc) != nil {
		return LayoutEmploymentLed
	}
	return DeriveResumeLayoutFromDoc(doc)
}

func DeriveResumeLayoutFromDoc(doc map[string]any) string {
	switch str(doc, "paidWorkExperience") {
	case PaidNone:
		return LayoutProjectOnly
	case PaidInternshipOnly:
		return LayoutHybrid
	default:
		return LayoutEmploymentLed
	}
}

// MinProjectsRequired returns the minimum completed projects for the profile mode.
func MinProjectsRequired(mode string) int {
	switch mode {
	case ModeEarly:
		return 2
	default:
		return 1
	}
}

func isExperiencedYears(years string) bool {
	switch years {
	case "3-5", "5-8", "8-12", "12+":
		return true
	default:
		return false
	}
}

func isSeniorExperienced(seniority string) bool {
	switch seniority {
	case "mid", "senior", "staff", "principal", "lead", "manager", "director":
		return true
	default:
		return false
	}
}

func str(doc map[string]any, key string) string {
	v, ok := doc[key]
	if !ok || v == nil {
		return ""
	}
	s, _ := v.(string)
	return strings.TrimSpace(s)
}
