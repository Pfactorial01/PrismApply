package tailoring

import (
	"bytes"
	"fmt"
	"html"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"prismapply/api/internal/config"
)

const baseCSS = `
  @page { size: A4; margin: 0.6in 0.75in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-size: 10pt; line-height: 1.45; color: #111; max-width: 7in; margin: 0 auto; }
  .section-title { font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin-top: 10px; margin-bottom: 4px; }
  .exp-block { margin-top: 6px; }
  .exp-header { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
  .exp-company { font-weight: 700; }
  .exp-sep { font-weight: 400; font-style: normal; }
  .exp-role { font-style: italic; }
  .exp-meta { font-size: 9pt; opacity: 0.85; margin-left: auto; }
  .bullets { list-style: none; padding-left: 0; margin-top: 2px; }
  .bullets li { position: relative; padding-left: 14px; margin-bottom: 2px; font-size: 9.5pt; line-height: 1.4; }
  .bullets li::before { content: "•"; position: absolute; left: 2px; }
  .summary { font-size: 9.5pt; margin-bottom: 8px; }
  .proj-title { font-weight: 700; margin-top: 4px; }
`

var templateCSS = map[ResumeTemplateID]string{
	TemplateClassic: `body { font-family: "Noto Serif", Georgia, serif; }
.name { font-size: 18pt; font-weight: 700; text-align: center; letter-spacing: 1px; }
.contact { text-align: center; font-size: 9pt; margin-bottom: 10px; }
.section-title { border-bottom: 1px solid #000; padding-bottom: 1px; }`,
	TemplateModern: `body { font-family: "Helvetica Neue", Arial, sans-serif; }
.name { font-size: 20pt; font-weight: 700; text-align: left; border-left: 4px solid #2563eb; padding-left: 10px; }
.contact { text-align: left; font-size: 9pt; margin: 6px 0 12px 14px; color: #444; }
.section-title { color: #2563eb; border-bottom: 2px solid #2563eb; }`,
	TemplateCompact: `body { font-family: Arial, sans-serif; font-size: 9.5pt; }
.name { font-size: 16pt; font-weight: 700; }
.contact { font-size: 8.5pt; margin-bottom: 8px; }
.two-col { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }`,
	TemplateMinimal: `body { font-family: Georgia, serif; }
.name { font-size: 17pt; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; }
.contact { font-size: 9pt; margin: 8px 0 16px; color: #555; }
.section-title { font-weight: 400; letter-spacing: 2px; border: none; margin-top: 14px; }
.bullets li::before { content: "–"; }`,
	TemplateATS: `body { font-family: Arial, sans-serif; font-size: 11pt; }
.name { font-size: 14pt; font-weight: 700; }
.contact { font-size: 10pt; margin-bottom: 12px; }
.section-title { font-size: 11pt; border: none; text-decoration: underline; }
.exp-header { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
.exp-meta { flex-basis: 100%; margin-left: 0; font-size: 9pt; opacity: 0.85; }`,
}

func structuredResumeHTML(resume StructuredResume, templateID ResumeTemplateID) string {
	css := templateCSS[templateID]
	if css == "" {
		css = templateCSS[TemplateClassic]
	}
	body := buildBody(resume, templateID)
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>%s%s</style></head>
<body>%s</body></html>`, baseCSS, css, body)
}

func buildBody(resume StructuredResume, templateID ResumeTemplateID) string {
	contactParts := make([]string, len(resume.Contact))
	for i, c := range resume.Contact {
		contactParts[i] = html.EscapeString(c)
	}
	contact := strings.Join(contactParts, " · ")
	summary := ""
	if strings.TrimSpace(resume.Summary) != "" {
		summary = `<div class="summary">` + html.EscapeString(resume.Summary) + `</div>`
	}

	if templateID == TemplateCompact {
		edu := ""
		if len(resume.Education) > 0 {
			edu = `<div class="section-title">Education</div>` + renderEducation(resume.Education)
		}
		proj := ""
		if len(resume.Projects) > 0 {
			proj = `<div class="section-title">Projects</div>` + renderProjects(resume.Projects)
		}
		return fmt.Sprintf(`<div class="name">%s</div><div class="contact">%s</div>%s
<div class="two-col"><div class="sidebar"><div class="section-title">Skills</div>%s%s</div>
<div class="main"><div class="section-title">Experience</div>%s%s</div></div>`,
			html.EscapeString(resume.Name), contact, summary,
			renderSkillsInline(resume.Skills), edu,
			renderExperience(resume.Experience), proj)
	}

	skillsBlock := ""
	if len(resume.Skills) > 0 {
		skillsBlock = `<div class="section-title">Skills</div>` + renderSkills(resume.Skills)
	}
	expBlock := ""
	if len(resume.Experience) > 0 {
		expBlock = `<div class="section-title">Professional Experience</div>` + renderExperience(resume.Experience)
	}
	projBlock := ""
	if len(resume.Projects) > 0 {
		projBlock = `<div class="section-title">Projects</div>` + renderProjects(resume.Projects)
	}
	eduBlock := ""
	if len(resume.Education) > 0 {
		eduBlock = `<div class="section-title">Education</div>` + renderEducation(resume.Education)
	}

	if templateID == TemplateATS {
		return fmt.Sprintf(`<div class="name">%s</div><div class="contact">%s</div>%s%s%s%s%s`,
			html.EscapeString(resume.Name), contact, summary, skillsBlock, expBlock, projBlock, eduBlock)
	}
	return fmt.Sprintf(`<div class="name">%s</div><div class="contact">%s</div>%s%s%s%s%s`,
		html.EscapeString(resume.Name), contact, summary, expBlock, skillsBlock, projBlock, eduBlock)
}

func renderBullets(bullets []ResumeBullet) string {
	if len(bullets) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString(`<ul class="bullets">`)
	for _, bullet := range bullets {
		b.WriteString(`<li>`)
		b.WriteString(html.EscapeString(bullet.Text))
		b.WriteString(`</li>`)
	}
	b.WriteString(`</ul>`)
	return b.String()
}

func renderExperience(exp []ResumeExperience) string {
	var b strings.Builder
	for _, e := range exp {
		metaParts := filterNonEmpty([]string{e.Location, e.Dates})
		meta := ""
		if len(metaParts) > 0 {
			escaped := make([]string, len(metaParts))
			for i, p := range metaParts {
				escaped[i] = html.EscapeString(p)
			}
			meta = `<span class="exp-meta">` + strings.Join(escaped, " · ") + `</span>`
		}
		b.WriteString(fmt.Sprintf(`<div class="exp-block"><div class="exp-header">
<span class="exp-company">%s</span><span class="exp-sep"> · </span><span class="exp-role">%s</span>%s</div>%s</div>`,
			html.EscapeString(e.Company), html.EscapeString(e.Role), meta, renderBullets(e.Bullets)))
	}
	return b.String()
}

func renderSkills(skills []SkillCategory) string {
	var b strings.Builder
	b.WriteString(`<div class="skills-grid">`)
	for _, s := range skills {
		b.WriteString(fmt.Sprintf(`<div class="skill-group"><div class="skills-cat">%s</div><div>%s</div></div>`,
			html.EscapeString(s.Category), html.EscapeString(strings.Join(s.Items, ", "))))
	}
	b.WriteString(`</div>`)
	return b.String()
}

func renderSkillsInline(skills []SkillCategory) string {
	var b strings.Builder
	for _, s := range skills {
		b.WriteString(fmt.Sprintf(`<div class="skills-line"><span class="skills-cat">%s:</span> %s</div>`,
			html.EscapeString(s.Category), html.EscapeString(strings.Join(s.Items, ", "))))
	}
	return b.String()
}

func renderProjects(projects []ResumeProject) string {
	var b strings.Builder
	for _, p := range projects {
		b.WriteString(fmt.Sprintf(`<div class="proj-block"><div class="proj-title">%s</div>%s</div>`,
			html.EscapeString(p.Title), renderBullets(p.Bullets)))
	}
	return b.String()
}

func renderEducation(education []string) string {
	var b strings.Builder
	for _, e := range education {
		b.WriteString(`<div class="edu-line">`)
		b.WriteString(html.EscapeString(e))
		b.WriteString(`</div>`)
	}
	return b.String()
}

// RenderStructuredResumePDF renders resume HTML to PDF via headless Chrome.
func RenderStructuredResumePDF(cfg config.Config, resume StructuredResume, templateID ResumeTemplateID) ([]byte, error) {
	htmlDoc := structuredResumeHTML(resume, templateID)
	tmpDir, err := os.MkdirTemp("", "prismapply-resume-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	htmlPath := filepath.Join(tmpDir, "resume.html")
	pdfPath := filepath.Join(tmpDir, "resume.pdf")
	if err := os.WriteFile(htmlPath, []byte(htmlDoc), 0o644); err != nil {
		return nil, err
	}

	chrome := cfg.ChromePath
	if chrome == "" {
		chrome = "/usr/bin/google-chrome-stable"
	}
	cmd := exec.Command(chrome,
		"--headless=new",
		"--disable-gpu",
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--no-pdf-header-footer",
		"--print-to-pdf="+pdfPath,
		"file://"+htmlPath,
	)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("chrome pdf render: %w: %s", err, strings.TrimSpace(stderr.String()))
	}
	return os.ReadFile(pdfPath)
}

const coverLetterCSS = `
  @page { size: A4; margin: 0.75in; }
  body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; max-width: 6.5in; margin: 0 auto; }
  p { margin: 0 0 12px 0; }
`

func coverLetterHTML(body string) string {
	paras := strings.Split(strings.TrimSpace(body), "\n\n")
	var b strings.Builder
	for _, p := range paras {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		// Preserve single newlines within a paragraph as line breaks.
		escaped := html.EscapeString(p)
		escaped = strings.ReplaceAll(escaped, "\n", "<br>")
		b.WriteString("<p>")
		b.WriteString(escaped)
		b.WriteString("</p>")
	}
	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>%s</style></head>
<body>%s</body></html>`, coverLetterCSS, b.String())
}

// RenderCoverLetterPDF renders cover letter text to PDF via headless Chrome.
func RenderCoverLetterPDF(cfg config.Config, coverLetter string) ([]byte, error) {
	coverLetter = strings.TrimSpace(coverLetter)
	if coverLetter == "" {
		return nil, fmt.Errorf("empty cover letter")
	}
	htmlDoc := coverLetterHTML(coverLetter)
	tmpDir, err := os.MkdirTemp("", "prismapply-cover-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	htmlPath := filepath.Join(tmpDir, "cover.html")
	pdfPath := filepath.Join(tmpDir, "cover.pdf")
	if err := os.WriteFile(htmlPath, []byte(htmlDoc), 0o644); err != nil {
		return nil, err
	}

	chrome := cfg.ChromePath
	if chrome == "" {
		chrome = "/usr/bin/google-chrome-stable"
	}
	cmd := exec.Command(chrome,
		"--headless=new",
		"--disable-gpu",
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--no-pdf-header-footer",
		"--print-to-pdf="+pdfPath,
		"file://"+htmlPath,
	)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("chrome cover pdf: %w: %s", err, strings.TrimSpace(stderr.String()))
	}
	return os.ReadFile(pdfPath)
}
