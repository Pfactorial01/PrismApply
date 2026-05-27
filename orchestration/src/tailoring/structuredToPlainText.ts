import type { StructuredResume } from "./types.js";

/** Plain-text resume for DB display and backwards compatibility. */
export function structuredResumeToPlainText(resume: StructuredResume): string {
  const lines: string[] = [];
  lines.push(resume.name);
  lines.push(resume.contact.join(" | "));
  lines.push("");

  if (resume.summary?.trim()) {
    lines.push("SUMMARY");
    lines.push(resume.summary.trim());
    lines.push("");
  }

  if (resume.skills.length > 0) {
    lines.push("SKILLS");
    for (const cat of resume.skills) {
      lines.push(`${cat.category}: ${cat.items.join(", ")}`);
    }
    lines.push("");
  }

  if (resume.experience.length > 0) {
    lines.push("PROFESSIONAL EXPERIENCE");
    for (const exp of resume.experience) {
      const loc = exp.location ? ` | ${exp.location}` : "";
      const dates = exp.dates ? ` | ${exp.dates}` : "";
      lines.push(`**${exp.company}** - ${exp.role}${loc}${dates}`);
      for (const b of exp.bullets) {
        lines.push(`- ${b.text}`);
      }
      lines.push("");
    }
  }

  if (resume.projects?.length) {
    lines.push("PROJECTS");
    for (const p of resume.projects) {
      lines.push(`**${p.title}**`);
      for (const b of p.bullets) {
        lines.push(`- ${b.text}`);
      }
    }
    lines.push("");
  }

  if (resume.education?.length) {
    lines.push("EDUCATION");
    for (const e of resume.education) {
      lines.push(e);
    }
  }

  return lines.join("\n").trim();
}
