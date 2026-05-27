package matching

import (
	"encoding/json"
	"strings"
)

type profileDraft struct {
	WorkArrangement           string   `json:"workArrangement"`
	Region                    string   `json:"region"`
	Timezone                  string   `json:"timezone"`
	NeedsVisaSponsorship      bool     `json:"needsVisaSponsorship"`
	VisaStatus                string   `json:"visaStatus"`
	SeniorityTarget           string   `json:"seniorityTarget"`
	YearsExperience           string   `json:"yearsExperience"`
	PrimaryDiscipline         string   `json:"primaryDiscipline"`
	CompensationBand          string   `json:"compensationBand"`
	OpenToContract            bool     `json:"openToContract"`
	OpenToRelocate            bool     `json:"openToRelocate"`
	SelectedDealbreakerSlugs  []string `json:"selectedDealbreakerSlugs"`
	DealBreakersOtherNote     string   `json:"dealBreakersOtherNote"`
	SelectedIndustrySlugs     []string `json:"selectedIndustrySlugs"`
}

// BuildUserPreferences parses profile JSON into normalized preferences for gating.
func BuildUserPreferences(raw []byte) UserPreferences {
	var p profileDraft
	_ = json.Unmarshal(raw, &p)

	labels := make([]string, 0, len(p.SelectedDealbreakerSlugs))
	for _, slug := range p.SelectedDealbreakerSlugs {
		if slug == "" || slug == "db_other" {
			continue
		}
		labels = append(labels, labelForSlug(slug))
	}

	bullets := buildHardBullets(p, labels)

	return UserPreferences{
		WorkArrangement:       strings.TrimSpace(p.WorkArrangement),
		Region:                strings.TrimSpace(p.Region),
		Timezone:              strings.TrimSpace(p.Timezone),
		NeedsVisaSponsorship:  p.NeedsVisaSponsorship || p.VisaStatus == "need_sponsorship",
		VisaStatus:            strings.TrimSpace(p.VisaStatus),
		SeniorityTarget:       strings.TrimSpace(p.SeniorityTarget),
		YearsExperience:       strings.TrimSpace(p.YearsExperience),
		PrimaryDiscipline:     strings.TrimSpace(p.PrimaryDiscipline),
		CompensationBand:      strings.TrimSpace(p.CompensationBand),
		OpenToContract:        p.OpenToContract,
		OpenToRelocate:        p.OpenToRelocate,
		DealbreakerSlugs:      append([]string(nil), p.SelectedDealbreakerSlugs...),
		DealbreakersOtherNote: strings.TrimSpace(p.DealBreakersOtherNote),
		IndustrySlugs:         append([]string(nil), p.SelectedIndustrySlugs...),
		DealbreakerLabels:     labels,
		HardPreferenceBullets: bullets,
	}
}

func buildHardBullets(p profileDraft, dealLabels []string) []string {
	var bullets []string
	if p.WorkArrangement != "" {
		bullets = append(bullets, "Work arrangement: "+labelForSlug(p.WorkArrangement))
	}
	if p.NeedsVisaSponsorship || p.VisaStatus == "need_sponsorship" {
		bullets = append(bullets, "Requires visa sponsorship")
	}
	if p.SeniorityTarget != "" {
		bullets = append(bullets, "Minimum seniority: "+labelForSlug(p.SeniorityTarget)+" (roles at or above this level are acceptable)")
	}
	if p.YearsExperience != "" {
		bullets = append(bullets, "Years experience: "+p.YearsExperience)
	}
	if !p.OpenToContract {
		bullets = append(bullets, "Not open to contract roles")
	}
	if p.OpenToRelocate {
		bullets = append(bullets, "Open to relocation and onsite roles")
	}
	if len(p.SelectedIndustrySlugs) > 0 {
		var ind []string
		for _, slug := range p.SelectedIndustrySlugs {
			if slug == "" {
				continue
			}
			ind = append(ind, labelForSlug(slug))
		}
		if len(ind) > 0 {
			bullets = append(bullets, "Target industries: "+strings.Join(ind, ", "))
		}
	}
	for _, l := range dealLabels {
		bullets = append(bullets, "Dealbreaker: "+l)
	}
	if p.DealBreakersOtherNote != "" {
		bullets = append(bullets, "Dealbreaker note: "+p.DealBreakersOtherNote)
	}
	return bullets
}
