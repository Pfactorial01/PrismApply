import { callJsonLLM } from "./openai.js";
import type { EvidenceMap, JdRequirements } from "./types.js";

const COVER_SCHEMA = {
  type: "object" as const,
  properties: {
    cover_letter: { type: "string" as const },
    cited_fields: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: ["cover_letter", "cited_fields"] as const,
  additionalProperties: false as const,
};

const SYSTEM = `Write a concise cover letter (not a second resume). Structure:
1. Opening: role + company + one specific hook from the JD or companies the applicant admires
2. Paragraph 2: strongest JD-aligned win with a metric from profile evidence
3. Paragraph 3: second proof point or stack fit
4. Close: enthusiasm; mention logistics only if profile supports (remote/relocation)

Rules:
- Ground every claim in the evidence map and profile. No invented facts.
- Ban generic filler unless profile uses similar language.
- 250-400 words. Professional tone matching applicant voice where possible.`;

export async function writeCoverLetter(input: {
  jobTitle: string;
  jobCompany: string;
  jd: JdRequirements;
  evidence: EvidenceMap;
}): Promise<{ coverLetter: string; citedFields: string[] }> {
  const user = `## Role
${input.jobTitle} at ${input.jobCompany}

## JD themes
Must-haves: ${input.jd.mustHaveSkills.join(", ")}
Themes: ${input.jd.responsibilityThemes.join(", ")}

## Top evidence
${JSON.stringify(input.evidence.items.filter((i) => i.evidence.length > 0).slice(0, 10), null, 2)}

## Motivations / admire
companiesYouAdmire: ${input.evidence.identity.companiesYouAdmire ?? ""}
whatYouWantNextNote: ${input.evidence.profileSections.find((s) => s.key === "experience")?.content.slice(0, 500) ?? ""}`;

  const parsed = await callJsonLLM<{ cover_letter: string; cited_fields: string[] }>(
    SYSTEM,
    user,
    { name: "cover_letter", schema: COVER_SCHEMA },
    0.35,
  );

  return {
    coverLetter: parsed.cover_letter.trim(),
    citedFields: parsed.cited_fields,
  };
}
