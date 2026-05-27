import { callJsonLLM } from "./openai.js";
import type { EvidenceMap, JdRequirements, StructuredResume } from "./types.js";
import { formatDensityHintsBlock, formatExpandHintsBlock } from "./resumeDensity.js";

const RESUME_SCHEMA = {
  type: "object" as const,
  properties: {
    name: { type: "string" as const },
    contact: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    summary: { type: "string" as const },
    skills: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          category: { type: "string" as const },
          items: {
            type: "array" as const,
            items: { type: "string" as const },
          },
        },
        required: ["category", "items"] as const,
        additionalProperties: false as const,
      },
    },
    experience: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          company: { type: "string" as const },
          role: { type: "string" as const },
          location: { type: "string" as const },
          dates: { type: "string" as const },
          bullets: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                text: { type: "string" as const },
                sourceRefs: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      field: { type: "string" as const },
                      excerpt: { type: "string" as const },
                    },
                    required: ["field", "excerpt"] as const,
                    additionalProperties: false as const,
                  },
                },
              },
              required: ["text", "sourceRefs"] as const,
              additionalProperties: false as const,
            },
          },
        },
        required: ["company", "role", "location", "dates", "bullets"] as const,
        additionalProperties: false as const,
      },
    },
    projects: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          title: { type: "string" as const },
          bullets: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                text: { type: "string" as const },
                sourceRefs: {
                  type: "array" as const,
                  items: {
                    type: "object" as const,
                    properties: {
                      field: { type: "string" as const },
                      excerpt: { type: "string" as const },
                    },
                    required: ["field", "excerpt"] as const,
                    additionalProperties: false as const,
                  },
                },
              },
              required: ["text", "sourceRefs"] as const,
              additionalProperties: false as const,
            },
          },
        },
        required: ["title", "bullets"] as const,
        additionalProperties: false as const,
      },
    },
    education: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: ["name", "contact", "summary", "skills", "experience", "projects", "education"] as const,
  additionalProperties: false as const,
};

const SYSTEM = `You write a tailored resume as structured JSON. Rules:
1. TRUTH ONLY — every claim must trace to the evidence map or profile sections below. Never invent employers, titles, dates, tools, or numeric metrics. Only use percentages, dollar amounts, or multipliers that appear verbatim in the profile or Expand-from fields.
2. JD-FIRST — reorder skills and bullets so JD must-haves and themes appear first. Rephrase with JD vocabulary without changing facts.
3. LENGTH — follow the Page target and minimum bullet counts in Resume density hints. Aim to fill the page target with substantive, profile-backed bullets — not generic filler.
4. EXPAND FROM PROFILE — when a role or project needs more bullets, decompose facts from resumePlainText, proudestProfessionalWins, honestCareerNarrative, story fields, and project summaries/impactMetrics. Each bullet must cite its source field in sourceRefs with a supporting excerpt. Do not merge unrelated invented outcomes.
5. ROLES — include all relevant employers from the profile resume/experience sections. Most recent role first. Within each role, order bullets by JD relevance.
6. PROJECTS — include relevant projects with multiple bullets when the profile supports it (summary, impactMetrics, tech stack). Omit projects only when clearly irrelevant to the JD.
7. SUMMARY — 2-4 lines when the profile supports it; lead with JD-aligned strengths.
8. SKILLS — categories led by JD stack/tools, then other profile-backed skills.
9. SOURCE REFS — every experience and project bullet needs sourceRefs pointing to the profile field and a short excerpt that supports the claim.`;

export async function writeStructuredResume(input: {
  jobTitle: string;
  jobCompany: string;
  jd: JdRequirements;
  evidence: EvidenceMap;
  retryNotes?: string[];
}): Promise<StructuredResume> {
  let user = `## Role
${input.jobTitle} at ${input.jobCompany}

## Resume density hints
${formatDensityHintsBlock(input.evidence.densityHints)}

## Expand from these profile fields (truth only — decompose into bullets, do not invent)
${formatExpandHintsBlock(input.evidence.expandFrom)}

## JD Requirement Sheet
${JSON.stringify(input.jd, null, 2)}

## Evidence Map
${JSON.stringify(input.evidence.items.slice(0, 25), null, 2)}

## Profile Identity
${JSON.stringify(input.evidence.identity, null, 2)}

## Profile Sections (full context)
${input.evidence.profileSections.map((s) => `### ${s.key}\n${s.content}`).join("\n\n")}`;

  if (input.retryNotes?.length) {
    user += `\n\n## Fix these validation issues from the previous attempt\n`;
    for (const note of input.retryNotes) {
      user += `- ${note}\n`;
    }
  }

  const parsed = await callJsonLLM<StructuredResume>(SYSTEM, user, {
    name: "structured_resume",
    schema: RESUME_SCHEMA,
  });

  return {
    ...parsed,
    contact: parsed.contact.filter(Boolean),
    skills: parsed.skills.filter((s) => s.items.length > 0),
    experience: parsed.experience.filter((e) => e.company || e.role),
    projects: parsed.projects?.filter((p) => p.title || p.bullets.length > 0),
    education: parsed.education?.filter(Boolean),
  };
}
