import type { StructuredResume, ResumeTemplateId } from "./types.js";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderBullets(bullets: { text: string }[], bulletClass = ""): string {
  if (bullets.length === 0) return "";
  return `<ul class="bullets ${bulletClass}">${bullets
    .map((b) => `<li>${escapeHtml(b.text)}</li>`)
    .join("")}</ul>`;
}

function renderExperience(exp: StructuredResume["experience"]): string {
  return exp
    .map((e: StructuredResume["experience"][number]) => {
      const meta = [e.location, e.dates].filter((s): s is string => Boolean(s)).map(escapeHtml);
      return `<div class="exp-block">
        <div class="exp-header">
          <span class="exp-company">${escapeHtml(e.company)}</span>
          <span class="exp-role">${escapeHtml(e.role)}</span>
          ${meta.length ? `<span class="exp-meta">${meta.join(" · ")}</span>` : ""}
        </div>
        ${renderBullets(e.bullets)}
      </div>`;
    })
    .join("");
}

function renderSkills(skills: StructuredResume["skills"], inline = false): string {
  if (skills.length === 0) return "";
  if (inline) {
    return skills
      .map(
        (s: StructuredResume["skills"][number]) =>
          `<div class="skills-line"><span class="skills-cat">${escapeHtml(s.category)}:</span> ${escapeHtml(s.items.join(", "))}</div>`,
      )
      .join("");
  }
  return `<div class="skills-grid">${skills
    .map(
      (s: StructuredResume["skills"][number]) =>
        `<div class="skill-group"><div class="skills-cat">${escapeHtml(s.category)}</div><div>${escapeHtml(s.items.join(", "))}</div></div>`,
    )
    .join("")}</div>`;
}

function renderProjects(projects: StructuredResume["projects"]): string {
  if (!projects?.length) return "";
  return projects
    .map(
      (p: NonNullable<StructuredResume["projects"]>[number]) =>
        `<div class="proj-block"><div class="proj-title">${escapeHtml(p.title)}</div>${renderBullets(p.bullets)}</div>`,
    )
    .join("");
}

function renderEducation(education: string[] | undefined): string {
  if (!education?.length) return "";
  return education.map((e) => `<div class="edu-line">${escapeHtml(e)}</div>`).join("");
}

const BASE_CSS = `
  @page { margin: 0.5in 0.6in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-size: 10pt; line-height: 1.45; color: #111; max-width: 7in; margin: 0 auto; }
  .section-title { font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin-top: 10px; margin-bottom: 4px; }
  .exp-block { margin-top: 6px; }
  .exp-header { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
  .exp-company { font-weight: 700; }
  .exp-role { font-style: italic; }
  .exp-meta { font-size: 9pt; opacity: 0.85; margin-left: auto; }
  .bullets { list-style: none; padding-left: 0; margin-top: 2px; }
  .bullets li { position: relative; padding-left: 14px; margin-bottom: 2px; font-size: 9.5pt; line-height: 1.4; }
  .bullets li::before { content: "•"; position: absolute; left: 2px; }
  .summary { font-size: 9.5pt; margin-bottom: 8px; }
  .proj-title { font-weight: 700; margin-top: 4px; }
`;

const TEMPLATE_STYLES: Record<ResumeTemplateId, { css: string; layout: "classic" | "modern" | "compact" | "minimal" | "ats" }> = {
  classic: {
    css: `
      body { font-family: "Noto Serif", Georgia, serif; }
      .name { font-size: 18pt; font-weight: 700; text-align: center; letter-spacing: 1px; }
      .contact { text-align: center; font-size: 9pt; margin-bottom: 10px; }
      .section-title { border-bottom: 1px solid #000; padding-bottom: 1px; }
    `,
    layout: "classic",
  },
  modern: {
    css: `
      body { font-family: "Helvetica Neue", Arial, sans-serif; }
      .name { font-size: 20pt; font-weight: 700; text-align: left; border-left: 4px solid #2563eb; padding-left: 10px; }
      .contact { text-align: left; font-size: 9pt; margin: 6px 0 12px 14px; color: #444; }
      .section-title { color: #2563eb; border-bottom: 2px solid #2563eb; }
    `,
    layout: "modern",
  },
  compact: {
    css: `
      body { font-family: Arial, sans-serif; font-size: 9.5pt; }
      .name { font-size: 16pt; font-weight: 700; }
      .contact { font-size: 8.5pt; margin-bottom: 8px; }
      .two-col { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; }
      .sidebar .section-title { font-size: 9pt; }
      .skills-grid { font-size: 8.5pt; }
      .skill-group { margin-bottom: 4px; }
    `,
    layout: "compact",
  },
  minimal: {
    css: `
      body { font-family: Georgia, serif; }
      .name { font-size: 17pt; font-weight: 400; letter-spacing: 2px; text-transform: uppercase; }
      .contact { font-size: 9pt; margin: 8px 0 16px; color: #555; }
      .section-title { font-weight: 400; letter-spacing: 2px; border: none; margin-top: 14px; }
      .bullets li::before { content: "–"; }
    `,
    layout: "minimal",
  },
  ats: {
    css: `
      body { font-family: Arial, sans-serif; font-size: 11pt; }
      .name { font-size: 14pt; font-weight: 700; }
      .contact { font-size: 10pt; margin-bottom: 12px; }
      .section-title { font-size: 11pt; border: none; text-decoration: underline; }
      .exp-header { display: block; }
      .exp-meta { display: block; margin-left: 0; }
    `,
    layout: "ats",
  },
};

function buildBody(resume: StructuredResume, layout: ResumeTemplateId): string {
  const contact = resume.contact.map(escapeHtml).join(" · ");
  const summary = resume.summary?.trim()
    ? `<div class="summary">${escapeHtml(resume.summary)}</div>`
    : "";

  if (layout === "compact") {
    return `
      <div class="name">${escapeHtml(resume.name)}</div>
      <div class="contact">${contact}</div>
      ${summary}
      <div class="two-col">
        <div class="sidebar">
          <div class="section-title">Skills</div>
          ${renderSkills(resume.skills, true)}
          ${resume.education?.length ? `<div class="section-title">Education</div>${renderEducation(resume.education)}` : ""}
        </div>
        <div class="main">
          <div class="section-title">Experience</div>
          ${renderExperience(resume.experience)}
          ${resume.projects?.length ? `<div class="section-title">Projects</div>${renderProjects(resume.projects)}` : ""}
        </div>
      </div>`;
  }

  const skillsFirst = layout === "ats";
  const skillsBlock = resume.skills.length
    ? `<div class="section-title">Skills</div>${renderSkills(resume.skills, layout === "ats")}`
    : "";
  const expBlock = resume.experience.length
    ? `<div class="section-title">Professional Experience</div>${renderExperience(resume.experience)}`
    : "";
  const projBlock = resume.projects?.length
    ? `<div class="section-title">Projects</div>${renderProjects(resume.projects)}`
    : "";
  const eduBlock = resume.education?.length
    ? `<div class="section-title">Education</div>${renderEducation(resume.education)}`
    : "";

  return `
    <div class="name">${escapeHtml(resume.name)}</div>
    <div class="contact">${contact}</div>
    ${summary}
    ${skillsFirst ? skillsBlock + expBlock : expBlock + skillsBlock}
    ${projBlock}
    ${eduBlock}`;
}

export function structuredResumeHtml(
  resume: StructuredResume,
  templateId: ResumeTemplateId,
): string {
  const tpl = TEMPLATE_STYLES[templateId] ?? TEMPLATE_STYLES.classic;
  const body = buildBody(resume, templateId);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>${BASE_CSS}${tpl.css}</style>
</head>
<body>
${body}
</body>
</html>`;
}
