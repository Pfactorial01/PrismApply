import type { EvidenceMap, EvidenceItem, JdRequirements } from "./types.js";
import {
  buildResumeDensityHints,
  collectExpandFieldHints,
} from "./resumeDensity.js";

const SECTION_KEYS = [
  "identity",
  "targets",
  "resume",
  "skills",
  "experience",
  "projects",
  "stories",
  "preferences_soft",
  "constraints",
] as const;

function profileField(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  if (typeof v === "string") return v.trim();
  return "";
}

function buildIdentityBlock(p: Record<string, unknown>): Record<string, string> {
  const identity: Record<string, string> = {};
  for (const key of [
    "fullName",
    "preferredName",
    "phoneNumber",
    "headline",
    "currentCompany",
    "region",
    "cityOrDetail",
    "timezone",
    "linkedInUrl",
    "portfolioUrl",
    "githubUrl",
    "otherLinks",
    "visaStatus",
    "workArrangement",
    "companiesYouAdmire",
    "yearsExperience",
    "seniorityTarget",
  ]) {
    const val = profileField(p, key);
    if (val) identity[key] = val;
  }
  if (p.needsVisaSponsorship === true) {
    identity.needsVisaSponsorship = "true";
  }
  return identity;
}

function keywordOverlap(text: string, terms: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const term of terms) {
    const t = term.toLowerCase().trim();
    if (t.length >= 3 && lower.includes(t)) hits++;
  }
  return hits;
}

function collectProfileSections(
  profileJson: Record<string, unknown>,
  jd: JdRequirements,
): { key: string; content: string; score: number }[] {
  const sections: { key: string; content: string; score: number }[] = [];
  const jdTerms = [
    ...jd.mustHaveSkills,
    ...jd.niceToHaveSkills,
    ...jd.responsibilityThemes,
    ...jd.atsKeywords,
    ...jd.stack,
    ...jd.roleTitleVariants,
  ];

  const add = (key: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const score = keywordOverlap(trimmed, jdTerms);
    sections.push({ key, content: trimmed, score });
  };

  add("identity", Object.entries(buildIdentityBlock(profileJson))
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n"));

  const resume = profileField(profileJson, "resumePlainText");
  if (resume) add("resume", resume);

  const skillsParts = [
    profileField(profileJson, "skillsCoreNarrative"),
    profileField(profileJson, "toolsOtherNote"),
    profileField(profileJson, "educationDetails"),
    profileField(profileJson, "highestEducation"),
  ].filter(Boolean);
  if (skillsParts.length) add("skills", skillsParts.join("\n"));

  const expParts = [
    profileField(profileJson, "honestCareerNarrative"),
    profileField(profileJson, "proudestProfessionalWins"),
    profileField(profileJson, "gapsOrNonTraditionalPath"),
    profileField(profileJson, "targetRolesNarrative"),
    profileField(profileJson, "whatYouWantNextNote"),
  ].filter(Boolean);
  if (expParts.length) add("experience", expParts.join("\n\n"));

  const projects = profileJson.projects;
  if (Array.isArray(projects)) {
    projects.forEach((pr, i) => {
      if (!pr || typeof pr !== "object") return;
      const p = pr as Record<string, unknown>;
      const lines = [
        p.title ? `Project: ${p.title}` : "",
        p.summary ?? "",
        p.primaryTechSlug ? `Tech: ${p.primaryTechSlug}` : "",
        p.techStackExtra ?? "",
        p.impactMetrics ?? "",
      ].filter((s) => typeof s === "string" && s.trim());
      if (lines.length) add(`projects_${i}`, lines.join("\n"));
    });
  }

  const storyKeys = [
    "storyHardestTechnicalChallenge",
    "storyDisagreementOrConflict",
    "storyBiggestMistake",
    "storyLeadingWithoutAuthority",
    "storyTightDeadline",
    "storyConflictingPriorities",
    "storyProcessImprovement",
    "storyDifficultFeedback",
    "storyMentoringTeaching",
    "storyCrossFunctionalCollaboration",
    "storyAmbiguousProblem",
    "storyEthicalOrRiskTradeoff",
  ];
  const stories = storyKeys.map((k) => profileField(profileJson, k)).filter(Boolean);
  if (stories.length) add("stories", stories.join("\n\n"));

  const soft = [
    profileField(profileJson, "motivationsOtherNote"),
    profileField(profileJson, "companiesYouAdmire"),
  ].filter(Boolean);
  if (soft.length) add("preferences_soft", soft.join("\n"));

  return sections.sort((a, b) => b.score - a.score);
}

function findEvidence(
  sections: { key: string; content: string; score: number }[],
  requirement: string,
): { sourceField: string; excerpt: string; relevanceScore: number }[] {
  const reqLower = requirement.toLowerCase();
  const out: { sourceField: string; excerpt: string; relevanceScore: number }[] = [];

  for (const sec of sections) {
    if (!sec.content.toLowerCase().includes(reqLower.slice(0, Math.min(12, reqLower.length)))) {
      const words = reqLower.split(/\s+/).filter((w) => w.length > 3);
      const hits = words.filter((w) => sec.content.toLowerCase().includes(w)).length;
      if (hits === 0) continue;
    }
    const idx = sec.content.toLowerCase().indexOf(reqLower.slice(0, 8));
    const start = Math.max(0, idx >= 0 ? idx - 40 : 0);
    const excerpt = sec.content.slice(start, start + 200).trim();
    out.push({
      sourceField: sec.key,
      excerpt,
      relevanceScore: sec.score + (idx >= 0 ? 2 : 1),
    });
  }

  return out.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 3);
}

export function buildEvidenceMap(
  profileJson: Record<string, unknown>,
  jd: JdRequirements,
  embeddingSections: { key: string; content: string; similarity: number }[],
): EvidenceMap {
  const profileSections = collectProfileSections(profileJson, jd);

  // Merge embedding-retrieved chunks (raise limit vs legacy top-5)
  for (const chunk of embeddingSections) {
    const existing = profileSections.find((s) => s.key === chunk.key);
    if (existing) {
      existing.score += chunk.similarity * 5;
    } else {
      profileSections.push({
        key: chunk.key,
        content: chunk.content,
        score: chunk.similarity * 5,
      });
    }
  }

  profileSections.sort((a, b) => b.score - a.score);

  const items: EvidenceItem[] = [];
  const addItems = (
    reqs: string[],
    type: EvidenceItem["requirementType"],
  ) => {
    for (const req of reqs) {
      if (!req.trim()) continue;
      items.push({
        requirement: req,
        requirementType: type,
        evidence: findEvidence(profileSections, req),
      });
    }
  };

  addItems(jd.mustHaveSkills, "must_have");
  addItems(jd.niceToHaveSkills, "nice_to_have");
  addItems(jd.responsibilityThemes, "theme");
  addItems(jd.atsKeywords.slice(0, 15), "keyword");

  return {
    identity: buildIdentityBlock(profileJson),
    items,
    profileSections: profileSections.slice(0, 20),
    densityHints: buildResumeDensityHints(profileJson),
    expandFrom: collectExpandFieldHints(profileJson),
  };
}

export function sectionKeysForRetrieval(): readonly string[] {
  return SECTION_KEYS;
}
