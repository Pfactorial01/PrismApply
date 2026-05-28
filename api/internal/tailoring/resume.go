package tailoring

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"prismapply/api/internal/config"
	"prismapply/api/internal/profilemode"
)

var resumeSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"name":    map[string]any{"type": "string"},
		"contact": arrayOfStrings(),
		"summary": map[string]any{"type": "string"},
		"skills": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"category": map[string]any{"type": "string"},
					"items":    arrayOfStrings(),
				},
				"required":             []string{"category", "items"},
				"additionalProperties": false,
			},
		},
		"experience": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"company":  map[string]any{"type": "string"},
					"role":     map[string]any{"type": "string"},
					"location": map[string]any{"type": "string"},
					"dates":    map[string]any{"type": "string"},
					"bullets":  bulletArraySchema(),
				},
				"required":             []string{"company", "role", "location", "dates", "bullets"},
				"additionalProperties": false,
			},
		},
		"projects": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"title":   map[string]any{"type": "string"},
					"bullets": bulletArraySchema(),
				},
				"required":             []string{"title", "bullets"},
				"additionalProperties": false,
			},
		},
		"education": arrayOfStrings(),
	},
	"required":             []string{"name", "contact", "summary", "skills", "experience", "projects", "education"},
	"additionalProperties": false,
}

func bulletArraySchema() map[string]any {
	return map[string]any{
		"type": "array",
		"items": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"text": map[string]any{"type": "string"},
				"sourceRefs": map[string]any{
					"type": "array",
					"items": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"field":   map[string]any{"type": "string"},
							"excerpt": map[string]any{"type": "string"},
						},
						"required":             []string{"field", "excerpt"},
						"additionalProperties": false,
					},
				},
			},
			"required":             []string{"text", "sourceRefs"},
			"additionalProperties": false,
		},
	}
}

const resumeSystemPrompt = `You write a tailored resume as structured JSON. Rules:
1. TRUTH ONLY — every claim must trace to the evidence map or profile sections below. Never invent employers, titles, dates, tools, or numeric metrics. Only use percentages, dollar amounts, or multipliers that appear verbatim in the profile or Expand-from fields.
2. JD-FIRST — reorder skills and bullets so JD must-haves and themes appear first. Rephrase with JD vocabulary without changing facts.
3. LENGTH — follow the Page target and minimum bullet counts in Resume density hints. Aim to fill the page target with substantive, profile-backed bullets — not generic filler.
4. EXPAND FROM PROFILE — when a role or project needs more bullets, decompose facts from resumePlainText, proudestProfessionalWins, honestCareerNarrative, story fields, and project summaries/impactMetrics. Each bullet must cite its source field in sourceRefs with a supporting excerpt. Do not merge unrelated invented outcomes.
5. ROLES — include all relevant employers from the profile resume/experience sections. Most recent role first. Within each role, order bullets by JD relevance.
6. PROJECTS — include relevant projects with multiple bullets when the profile supports it (summary, impactMetrics, tech stack). Omit projects only when clearly irrelevant to the JD.
7. SUMMARY — 2-4 lines when the profile supports it; lead with JD-aligned strengths.
8. SKILLS — categories led by JD stack/tools, then other profile-backed skills.
9. SOURCE REFS — every experience and project bullet needs sourceRefs pointing to the profile field and a short excerpt that supports the claim.`

func WriteStructuredResume(ctx context.Context, cfg config.Config, jobTitle, jobCompany string, jd JdRequirements, evidence EvidenceMap, retryNotes ...[]string) (StructuredResume, error) {
	items := evidence.Items
	if len(items) > 25 {
		items = items[:25]
	}
	itemsJSON, _ := json.MarshalIndent(items, "", "  ")
	idJSON, _ := json.MarshalIndent(evidence.Identity, "", "  ")

	var sections strings.Builder
	for _, s := range evidence.ProfileSections {
		sections.WriteString("### ")
		sections.WriteString(s.Key)
		sections.WriteString("\n")
		sections.WriteString(s.Content)
		sections.WriteString("\n\n")
	}

	user := "## Role\n" + jobTitle + " at " + jobCompany + "\n\n## Resume density hints\n" +
		formatDensityHintsBlock(evidence.DensityHints) +
		"\n\n## Expand from these profile fields (truth only — decompose into bullets, do not invent)\n" +
		formatExpandHintsBlock(evidence.ExpandFrom) +
		"\n\n## JD Requirement Sheet\n" + mustJSON(jd) +
		"\n\n## Evidence Map\n" + string(itemsJSON) +
		"\n\n## Profile Identity\n" + string(idJSON) +
		"\n\n## Profile Sections (full context)\n" + sections.String()

	if len(retryNotes) > 0 && len(retryNotes[0]) > 0 {
		user += "\n\n## Fix these validation issues from the previous attempt\n"
		for _, note := range retryNotes[0] {
			user += "- " + note + "\n"
		}
	}

	var parsed StructuredResume
	if err := CallJSONLLM(ctx, cfg, resumeSystemPrompt, user, "structured_resume", resumeSchema, 0.25, &parsed); err != nil {
		return StructuredResume{}, err
	}
	return cleanStructuredResume(parsed), nil
}

func cleanStructuredResume(r StructuredResume) StructuredResume {
	var contact []string
	for _, c := range r.Contact {
		if strings.TrimSpace(c) != "" {
			contact = append(contact, c)
		}
	}
	var skills []SkillCategory
	for _, s := range r.Skills {
		if len(s.Items) > 0 {
			skills = append(skills, s)
		}
	}
	var exp []ResumeExperience
	for _, e := range r.Experience {
		if strings.TrimSpace(e.Company) != "" || strings.TrimSpace(e.Role) != "" {
			exp = append(exp, e)
		}
	}
	var projects []ResumeProject
	for _, p := range r.Projects {
		if strings.TrimSpace(p.Title) != "" || len(p.Bullets) > 0 {
			projects = append(projects, p)
		}
	}
	var edu []string
	for _, e := range r.Education {
		if strings.TrimSpace(e) != "" {
			edu = append(edu, e)
		}
	}
	r.Contact = contact
	r.Skills = skills
	r.Experience = exp
	r.Projects = projects
	r.Education = edu
	return r
}

func ValidateStructuredResume(resume StructuredResume, resumeLayout string) ValidationResult {
	var warnings []string
	cited := map[string]struct{}{}

	if strings.TrimSpace(resume.Name) == "" {
		warnings = append(warnings, "Missing name")
	}
	if len(resume.Contact) == 0 {
		warnings = append(warnings, "Missing contact info")
	}
	if len(resume.Skills) == 0 {
		warnings = append(warnings, "Missing skills section")
	}
	if len(resume.Education) == 0 && resumeLayout != profilemode.LayoutEmploymentLed {
		warnings = append(warnings, "Missing education section")
	}
	if len(resume.Experience) == 0 && len(resume.Projects) == 0 {
		warnings = append(warnings, "No experience or projects")
	}
	if resumeLayout == profilemode.LayoutProjectOnly && len(resume.Experience) > 0 {
		warnings = append(warnings, "project_only layout must not include experience entries")
	}

	minRecent, minOther, minProject := minBulletsMostRecentRole, minBulletsOtherRole, minBulletsPerProject
	switch resumeLayout {
	case profilemode.LayoutProjectOnly:
		minRecent, minOther = 0, 0
		minProject = 3
	case profilemode.LayoutHybrid:
		minRecent, minOther = 2, 2
		minProject = 3
	}

	for i, exp := range resume.Experience {
		if strings.TrimSpace(exp.Company) == "" {
			warnings = append(warnings, "Experience entry missing company")
		}
		if strings.TrimSpace(exp.Role) == "" {
			warnings = append(warnings, "Experience entry missing role")
		}
		minBullets := minOther
		if i == 0 {
			minBullets = minRecent
		}
		if minBullets > 0 && len(exp.Bullets) < minBullets {
			warnings = append(warnings, fmt.Sprintf("%s needs at least %d bullets (has %d)",
				orDefault(exp.Company, "Most recent role"), minBullets, len(exp.Bullets)))
		}
		for _, b := range exp.Bullets {
			if strings.TrimSpace(b.Text) == "" {
				warnings = append(warnings, "Empty bullet")
			}
			if len(b.SourceRefs) == 0 {
				warnings = append(warnings, `Bullet without sourceRef: "`+truncate(b.Text, 40)+`..."`)
			} else {
				for _, ref := range b.SourceRefs {
					cited[ref.Field] = struct{}{}
				}
			}
		}
	}
	for _, proj := range resume.Projects {
		if strings.TrimSpace(proj.Title) == "" {
			continue
		}
		if len(proj.Bullets) < minProject {
			warnings = append(warnings, fmt.Sprintf("Project %q needs at least %d bullets (has %d)",
				proj.Title, minProject, len(proj.Bullets)))
		}
		for _, b := range proj.Bullets {
			if strings.TrimSpace(b.Text) == "" {
				warnings = append(warnings, "Empty project bullet")
			}
			if len(b.SourceRefs) == 0 {
				warnings = append(warnings, `Project bullet without sourceRef: "`+truncate(b.Text, 40)+`..."`)
			} else {
				for _, ref := range b.SourceRefs {
					cited[ref.Field] = struct{}{}
				}
			}
		}
	}

	ok := true
	for _, w := range warnings {
		if !strings.Contains(w, "sourceRef") {
			ok = false
			break
		}
	}

	var citedFields []string
	for f := range cited {
		citedFields = append(citedFields, f)
	}
	return ValidationResult{OK: ok, Warnings: warnings, CitedFields: citedFields}
}

func mergeMetadataCitations(meta *TailorMetadata, cited []string) {
	seen := map[string]struct{}{}
	for _, f := range meta.CitedFields {
		seen[f] = struct{}{}
	}
	for _, f := range cited {
		if _, ok := seen[f]; !ok {
			meta.CitedFields = append(meta.CitedFields, f)
			seen[f] = struct{}{}
		}
	}
}

func mustJSON(v any) string {
	b, _ := json.MarshalIndent(v, "", "  ")
	return string(b)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
