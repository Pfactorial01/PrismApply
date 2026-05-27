import { callJsonLLM } from "./openai.js";
import type { JdRequirements } from "./types.js";
import type { JobFacts } from "../matching/index.js";

const JD_SCHEMA = {
  type: "object" as const,
  properties: {
    roleTitleVariants: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    seniority: { type: "string" as const },
    locationPolicy: { type: "string" as const },
    mustHaveSkills: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    niceToHaveSkills: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    responsibilityThemes: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    atsKeywords: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    stack: {
      type: "array" as const,
      items: { type: "string" as const },
    },
  },
  required: [
    "roleTitleVariants",
    "seniority",
    "locationPolicy",
    "mustHaveSkills",
    "niceToHaveSkills",
    "responsibilityThemes",
    "atsKeywords",
    "stack",
  ] as const,
  additionalProperties: false as const,
};

const SYSTEM = `You extract structured hiring requirements from a job posting.
Use verbatim phrases from the posting for ATS keywords when possible.
Do not invent requirements not supported by the text.
Seniority values: intern, junior, mid, senior, staff, principal, lead, manager, director, unknown.
Location policy: remote, hybrid, onsite, flexible, unknown.`;

export async function extractJdRequirements(input: {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  jobFacts: JobFacts;
}): Promise<JdRequirements> {
  const user = `Title: ${input.title}
Company: ${input.company}
Location: ${input.location ?? "Not specified"}
Seniority (parsed): ${input.jobFacts.seniorityLevel ?? "unknown"}
Remote policy: ${input.jobFacts.remotePolicy ?? "unknown"}
Employment: ${input.jobFacts.employmentType ?? "unknown"}

Description:
${input.description ?? "No description available"}`;

  const parsed = await callJsonLLM<JdRequirements>(SYSTEM, user, {
    name: "jd_requirements",
    schema: JD_SCHEMA,
  });

  if (input.jobFacts.seniorityLevel && input.jobFacts.seniorityLevel !== "unknown") {
    parsed.seniority = input.jobFacts.seniorityLevel;
  }
  if (input.jobFacts.remotePolicy && input.jobFacts.remotePolicy !== "unknown") {
    parsed.locationPolicy = input.jobFacts.remotePolicy;
  }

  return parsed;
}
