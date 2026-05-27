export const MIN_BULLETS_MOST_RECENT_ROLE = 4;
export const MIN_BULLETS_OTHER_ROLE = 2;
export const MIN_BULLETS_PER_PROJECT = 2;

export interface ResumeDensityHints {
  pageTarget: string;
  seniorityTarget: string;
  yearsExperience: string;
  minBulletsMostRecent: number;
  minBulletsOtherRole: number;
  minBulletsPerProject: number;
}

export interface ExpandFieldHint {
  field: string;
  content: string;
}

function profileStr(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  if (typeof v === "string") return v.trim();
  return "";
}

function isExtendedResumeSeniority(seniority: string, years: string): boolean {
  if (["staff", "principal", "director", "lead"].includes(seniority)) return true;
  if (["8-12", "12+"].includes(years)) return true;
  return false;
}

export function buildResumeDensityHints(profile: Record<string, unknown>): ResumeDensityHints {
  const seniorityTarget = profileStr(profile, "seniorityTarget");
  const yearsExperience = profileStr(profile, "yearsExperience");
  const pageTarget = isExtendedResumeSeniority(seniorityTarget, yearsExperience)
    ? "2 pages maximum"
    : "1 page";
  return {
    pageTarget,
    seniorityTarget,
    yearsExperience,
    minBulletsMostRecent: MIN_BULLETS_MOST_RECENT_ROLE,
    minBulletsOtherRole: MIN_BULLETS_OTHER_ROLE,
    minBulletsPerProject: MIN_BULLETS_PER_PROJECT,
  };
}

export function collectExpandFieldHints(profile: Record<string, unknown>): ExpandFieldHint[] {
  const hints: ExpandFieldHint[] = [];
  const add = (field: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    hints.push({
      field,
      content: trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}…` : trimmed,
    });
  };

  add("proudestProfessionalWins", profileStr(profile, "proudestProfessionalWins"));
  add("honestCareerNarrative", profileStr(profile, "honestCareerNarrative"));

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
  for (const key of storyKeys) {
    add(key, profileStr(profile, key));
  }

  const projects = profile.projects;
  if (Array.isArray(projects)) {
    projects.forEach((pr, i) => {
      if (!pr || typeof pr !== "object") return;
      const p = pr as Record<string, unknown>;
      const title = profileStr(p, "title");
      const parts = [
        profileStr(p, "summary"),
        profileStr(p, "impactMetrics"),
        profileStr(p, "techStackExtra"),
      ].filter(Boolean);
      if (parts.length === 0) return;
      let field = `projects[${i}]`;
      if (title) field = `projects[${i}].${title}`;
      add(field, parts.join("\n"));
    });
  }

  return hints;
}

function orDefault(value: string, fallback: string): string {
  return value.trim() ? value : fallback;
}

export function formatDensityHintsBlock(h: ResumeDensityHints): string {
  return `Page target: ${h.pageTarget}
Applicant seniority: ${orDefault(h.seniorityTarget, "unspecified")}
Years experience: ${orDefault(h.yearsExperience, "unspecified")}
Minimum bullets — most recent role: ${h.minBulletsMostRecent}; other roles: ${h.minBulletsOtherRole}; each included project: ${h.minBulletsPerProject}
Fill the page target using profile-backed detail. Do not pad with generic filler or invented metrics.`;
}

export function formatExpandHintsBlock(hints: ExpandFieldHint[]): string {
  if (hints.length === 0) {
    return "(none — use resume and experience sections only)";
  }
  return hints.map((h) => `### ${h.field}\n${h.content}`).join("\n\n");
}
