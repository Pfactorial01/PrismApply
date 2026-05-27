package tailoring

import (
	"regexp"
	"strings"
	"unicode"
)

const maxFilenamePartLen = 40

var nonWord = regexp.MustCompile(`[^\w\s-]`)

func sanitizeFilenamePart(s string) string {
	s = strings.TrimSpace(s)
	s = nonWord.ReplaceAllString(s, "")
	s = strings.Join(strings.Fields(s), "_")
	s = regexp.MustCompile(`_+`).ReplaceAllString(s, "_")
	if len(s) > maxFilenamePartLen {
		s = s[:maxFilenamePartLen]
	}
	return strings.Trim(s, "_")
}

func buildResumeFilename(fullName, company, roleTitle string) string {
	name := sanitizeFilenamePart(fullName)
	if name == "" {
		name = "Applicant"
	}
	co := sanitizeFilenamePart(company)
	if co == "" {
		co = "Company"
	}
	role := sanitizeFilenamePart(roleTitle)
	if role == "" {
		role = "Role"
	}
	return name + "_" + co + "_" + role + "_Resume.pdf"
}

func buildCoverLetterFilename(fullName, company, roleTitle string) string {
	name := sanitizeFilenamePart(fullName)
	if name == "" {
		name = "Applicant"
	}
	co := sanitizeFilenamePart(company)
	if co == "" {
		co = "Company"
	}
	role := sanitizeFilenamePart(roleTitle)
	if role == "" {
		role = "Role"
	}
	return name + "_" + co + "_" + role + "_Cover_Letter.pdf"
}

var templates = []ResumeTemplateID{TemplateClassic, TemplateModern, TemplateCompact, TemplateMinimal, TemplateATS}

func pickTemplateID(userID, jobID string) ResumeTemplateID {
	seed := userID + ":" + jobID
	var hash uint32
	for _, r := range seed {
		hash = hash*31 + uint32(r)
	}
	return templates[hash%uint32(len(templates))]
}

func structuredResumeToPlainText(resume StructuredResume) string {
	var b strings.Builder
	b.WriteString(resume.Name)
	b.WriteString("\n")
	b.WriteString(strings.Join(resume.Contact, " | "))
	b.WriteString("\n\n")

	if strings.TrimSpace(resume.Summary) != "" {
		b.WriteString("SUMMARY\n")
		b.WriteString(strings.TrimSpace(resume.Summary))
		b.WriteString("\n\n")
	}
	if len(resume.Skills) > 0 {
		b.WriteString("SKILLS\n")
		for _, cat := range resume.Skills {
			b.WriteString(cat.Category)
			b.WriteString(": ")
			b.WriteString(strings.Join(cat.Items, ", "))
			b.WriteString("\n")
		}
		b.WriteString("\n")
	}
	if len(resume.Experience) > 0 {
		b.WriteString("PROFESSIONAL EXPERIENCE\n")
		for _, exp := range resume.Experience {
			line := "**" + exp.Company + "** - " + exp.Role
			if exp.Location != "" {
				line += " | " + exp.Location
			}
			if exp.Dates != "" {
				line += " | " + exp.Dates
			}
			b.WriteString(line)
			b.WriteString("\n")
			for _, bullet := range exp.Bullets {
				b.WriteString("- ")
				b.WriteString(bullet.Text)
				b.WriteString("\n")
			}
			b.WriteString("\n")
		}
	}
	if len(resume.Projects) > 0 {
		b.WriteString("PROJECTS\n")
		for _, p := range resume.Projects {
			b.WriteString("**")
			b.WriteString(p.Title)
			b.WriteString("**\n")
			for _, bullet := range p.Bullets {
				b.WriteString("- ")
				b.WriteString(bullet.Text)
				b.WriteString("\n")
			}
		}
		b.WriteString("\n")
	}
	if len(resume.Education) > 0 {
		b.WriteString("EDUCATION\n")
		for _, e := range resume.Education {
			b.WriteString(e)
			b.WriteString("\n")
		}
	}
	return strings.TrimSpace(b.String())
}

func profileStr(p map[string]any, key string) string {
	v, ok := p[key]
	if !ok {
		return ""
	}
	s, ok := v.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(s)
}

func boolPref(p map[string]any, key string) bool {
	v, ok := p[key]
	if !ok {
		return false
	}
	b, ok := v.(bool)
	return ok && b
}

func keywordOverlap(text string, terms []string) int {
	lower := strings.ToLower(text)
	hits := 0
	for _, term := range terms {
		t := strings.ToLower(strings.TrimSpace(term))
		if len(t) >= 3 && strings.Contains(lower, t) {
			hits++
		}
	}
	return hits
}

func isLetterOrDigit(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r)
}
