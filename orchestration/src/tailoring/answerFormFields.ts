import { callJsonLLM } from "./openai.js";
import type { ClassifiedField, EvidenceMap, FormFieldAnswer, JdRequirements } from "./types.js";

function profileStr(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  return typeof v === "string" ? v.trim() : "";
}

function matchLabel(label: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(label));
}

function resolveIdentityAnswer(
  field: ClassifiedField,
  identity: Record<string, string>,
  profile: Record<string, unknown>,
): string {
  const label = field.label.toLowerCase();
  if (matchLabel(label, [/\bfirst name\b/i])) {
    const full = identity.fullName ?? profileStr(profile, "fullName");
    return full.split(/\s+/)[0] ?? full;
  }
  if (matchLabel(label, [/\blast name\b/i])) {
    const full = identity.fullName ?? profileStr(profile, "fullName");
    const parts = full.split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(" ") : "";
  }
  if (matchLabel(label, [/\bfull name\b/i, /^name$/i])) {
    return identity.fullName ?? profileStr(profile, "fullName");
  }
  if (matchLabel(label, [/\bemail\b/i])) {
    return profileStr(profile, "email") || identity.email || "";
  }
  if (matchLabel(label, [/\bphone\b/i, /\bmobile\b/i])) {
    return identity.phoneNumber ?? profileStr(profile, "phoneNumber");
  }
  if (matchLabel(label, [/\blinkedin\b/i])) {
    return identity.linkedInUrl ?? profileStr(profile, "linkedInUrl");
  }
  if (matchLabel(label, [/\bgithub\b/i])) {
    return identity.githubUrl ?? profileStr(profile, "githubUrl");
  }
  if (matchLabel(label, [/\bportfolio\b/i, /\bwebsite\b/i])) {
    return identity.portfolioUrl ?? profileStr(profile, "portfolioUrl");
  }
  return "";
}

function resolveLocationAnswer(
  field: ClassifiedField,
  identity: Record<string, string>,
  profile: Record<string, unknown>,
): string {
  const label = field.label.toLowerCase();
  if (matchLabel(label, [/\bauthorized\b/i, /\bwork authorization\b/i, /\blegal.*work\b/i])) {
    const visa = identity.visaStatus ?? profileStr(profile, "visaStatus");
    if (visa) return visa;
    if (profile.needsVisaSponsorship === true) return "Requires visa sponsorship";
    return "Authorized to work";
  }
  if (matchLabel(label, [/\bremote\b/i])) {
    return identity.workArrangement ?? profileStr(profile, "workArrangement");
  }
  const parts = [
    profileStr(profile, "cityOrDetail"),
    identity.region ?? profileStr(profile, "region"),
  ].filter(Boolean);
  return parts.join(", ");
}

function resolveSelectAnswer(
  field: ClassifiedField,
  identity: Record<string, string>,
  profile: Record<string, unknown>,
): { value: string; lowConfidence: boolean } {
  const raw = resolveIdentityAnswer(field, identity, profile)
    || resolveLocationAnswer(field, identity, profile)
    || profileStr(profile, "visaStatus");

  if (!field.options?.length) {
    return { value: raw, lowConfidence: !raw };
  }

  const lower = raw.toLowerCase();
  for (const opt of field.options) {
    if (opt.toLowerCase() === lower) return { value: opt, lowConfidence: false };
    if (lower && opt.toLowerCase().includes(lower)) return { value: opt, lowConfidence: false };
    if (lower && lower.includes(opt.toLowerCase())) return { value: opt, lowConfidence: false };
  }
  return { value: raw, lowConfidence: true };
}

const BATCH_SCHEMA = {
  type: "object" as const,
  properties: {
    answers: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          position: { type: "number" as const },
          label: { type: "string" as const },
          value: { type: "string" as const },
          source_field: { type: "string" as const },
        },
        required: ["position", "label", "value", "source_field"] as const,
        additionalProperties: false as const,
      },
    },
  },
  required: ["answers"] as const,
  additionalProperties: false as const,
};

const BEHAVIORAL_SCHEMA = {
  type: "object" as const,
  properties: {
    value: { type: "string" as const },
    source_fields: {
      type: "array" as const,
      items: { type: "string" as const },
    },
    low_confidence: { type: "boolean" as const },
  },
  required: ["value", "source_fields", "low_confidence"] as const,
  additionalProperties: false as const,
};

async function answerBatchFields(
  fields: ClassifiedField[],
  profile: Record<string, unknown>,
  identity: Record<string, string>,
  jd: JdRequirements,
): Promise<FormFieldAnswer[]> {
  if (fields.length === 0) return [];

  const deterministic: FormFieldAnswer[] = [];
  const needsLLM: ClassifiedField[] = [];

  for (const f of fields) {
    if (f.fieldClass === "eeo") {
      deterministic.push({ label: f.label, value: "" });
      continue;
    }
    if (f.fieldClass === "identity" || f.fieldClass === "location") {
      const val =
        f.fieldClass === "identity"
          ? resolveIdentityAnswer(f, identity, profile)
          : resolveLocationAnswer(f, identity, profile);
      deterministic.push({ label: f.label, value: val, lowConfidence: f.required && !val });
      continue;
    }
    if (f.fieldClass === "select") {
      const { value, lowConfidence } = resolveSelectAnswer(f, identity, profile);
      deterministic.push({ label: f.label, value, lowConfidence });
      continue;
    }
    if (f.fieldClass === "short_text") {
      const val = resolveIdentityAnswer(f, identity, profile) || resolveLocationAnswer(f, identity, profile);
      if (val) {
        deterministic.push({ label: f.label, value: val });
        continue;
      }
    }
    needsLLM.push(f);
  }

  if (needsLLM.length === 0) return deterministic;

  const system = `Fill short application form fields from profile data only. Never invent facts. Empty string if unknown.
For select fields with options, output exact option text when possible.`;

  const user = `JD context: ${jd.roleTitleVariants[0] ?? ""} — themes: ${jd.responsibilityThemes.slice(0, 3).join(", ")}

Fields:
${needsLLM.map((f, i) => `${i + 1}. position=${f.position + 1} label="${f.label}" type=${f.field_type}${f.options?.length ? ` options=${JSON.stringify(f.options)}` : ""} required=${f.required}`).join("\n")}

Profile identity:
${JSON.stringify(identity, null, 2)}

Profile excerpt:
${JSON.stringify(profile, null, 2).slice(0, 6000)}`;

  const parsed = await callJsonLLM<{
    answers: { position: number; label: string; value: string; source_field: string }[];
  }>(system, user, { name: "batch_form_answers", schema: BATCH_SCHEMA });

  const llmAnswers: FormFieldAnswer[] = parsed.answers.map((a) => ({
    label: a.label,
    value: a.value,
    lowConfidence: !a.value.trim(),
    sourceRefs: a.source_field ? [{ field: a.source_field, excerpt: a.value.slice(0, 80) }] : [],
  }));

  return [...deterministic, ...llmAnswers];
}

async function answerBehavioralField(
  field: ClassifiedField,
  evidence: EvidenceMap,
  jd: JdRequirements,
  jobCompany: string,
): Promise<FormFieldAnswer> {
  const system = `Answer one behavioral or long-form application question. Ground in profile stories and narrative.
Max 2000 chars. Use applicant voice. No invented facts. If insufficient profile data, write a brief honest answer or leave shorter — do not fabricate metrics.`;

  const user = `Company: ${jobCompany}
Field: "${field.label}" (required=${field.required})
JD themes: ${jd.responsibilityThemes.join(", ")}

Relevant evidence:
${JSON.stringify(evidence.items.slice(0, 8), null, 2)}

Stories:
${evidence.profileSections.filter((s) => s.key.startsWith("stories")).map((s) => s.content).join("\n\n")}`;

  const parsed = await callJsonLLM<{
    value: string;
    source_fields: string[];
    low_confidence: boolean;
  }>(system, user, { name: "behavioral_answer", schema: BEHAVIORAL_SCHEMA }, 0.35);

  return {
    label: field.label,
    value: parsed.value.trim(),
    lowConfidence: parsed.low_confidence,
    sourceRefs: parsed.source_fields.map((f) => ({ field: f, excerpt: "" })),
  };
}

export async function answerFormFields(input: {
  fields: ClassifiedField[];
  profileJson: Record<string, unknown>;
  evidence: EvidenceMap;
  jd: JdRequirements;
  jobCompany: string;
  resumePdfUrl?: string;
}): Promise<FormFieldAnswer[]> {
  const byClass = new Map<string, ClassifiedField[]>();
  for (const f of input.fields) {
    if (f.fieldClass === "file") continue;
    const key = ["behavioral", "long_text"].includes(f.fieldClass) ? "behavioral" : "batch";
    const list = byClass.get(key) ?? [];
    list.push(f);
    byClass.set(key, list);
  }

  const answers: FormFieldAnswer[] = [];

  // File fields get PDF URL injected later
  for (const f of input.fields.filter((x) => x.fieldClass === "file")) {
    answers.push({ label: f.label, value: input.resumePdfUrl ?? "" });
  }

  const batchFields = byClass.get("batch") ?? [];
  const batchAnswers = await answerBatchFields(
    batchFields,
    input.profileJson,
    input.evidence.identity,
    input.jd,
  );
  answers.push(...batchAnswers);

  const behavioral = byClass.get("behavioral") ?? [];
  for (const f of behavioral) {
    answers.push(
      await answerBehavioralField(f, input.evidence, input.jd, input.jobCompany),
    );
  }

  return answers;
}

export function orderFormAnswers(
  answers: FormFieldAnswer[],
  formFields: ClassifiedField[],
): FormFieldAnswer[] {
  const byLabel = new Map(answers.map((a) => [a.label, a]));
  return formFields.map((f) => {
    const a = byLabel.get(f.label);
    return a ?? { label: f.label, value: "", lowConfidence: f.required };
  });
}
