/** Slug → human label (mirrors api/internal/matching/labels.go). */
export const SLUG_LABELS: Record<string, string> = {
  db_no_defense: "No defense sector",
  db_no_gambling: "No gambling",
  db_no_crypto: "No crypto-first products",
  db_no_oncall: "No heavy on-call",
  db_no_ads: "No surveillance / ads-only business",
  fintech: "FinTech",
  healthtech: "HealthTech / biotech",
  b2b_saas: "B2B SaaS",
  consumer: "Consumer tech",
  devtools: "Developer tools",
  infra_cloud: "Infra / cloud",
  climate: "Climate / sustainability",
  gov: "Gov / defense-adjacent",
  edtech: "EdTech",
  gaming: "Gaming",
  crypto: "Crypto / web3",
  remote: "Remote-first",
  hybrid: "Hybrid",
  onsite: "Mostly onsite",
  flexible: "Flexible / negotiable",
  intern: "Intern",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  staff: "Staff",
  principal: "Principal",
  lead: "Tech lead",
  manager: "Engineering manager",
  director: "Director+",
};

export function labelForSlug(slug: string): string {
  return SLUG_LABELS[slug] ?? slug;
}

export interface UserPreferences {
  workArrangement: string;
  region: string;
  timezone: string;
  needsVisaSponsorship: boolean;
  visaStatus: string;
  seniorityTarget: string;
  yearsExperience: string;
  primaryDiscipline: string;
  compensationBand: string;
  openToContract: boolean;
  openToRelocate: boolean;
  dealbreakerSlugs: string[];
  dealbreakersOtherNote: string;
  industrySlugs: string[];
  dealbreakerLabels: string[];
  hardPreferenceBullets: string[];
  matchTierMode?: string;
}

export interface JobFacts {
  remotePolicy: string;
  employmentType: string;
  seniorityLevel: string;
  requiresSponsorship?: boolean;
  industryTags: string[];
  hasHeavyOncall: boolean;
  salaryMinUsd?: number;
  salaryMaxUsd?: number;
  locationText: string;
  title: string;
  company: string;
}

export interface GateResult {
  ok: boolean;
  reasons: string[];
}

export interface ScoreBreakdown {
  resumePosting: number;
  skillsReqs: number;
  targetsPosting: number;
  experienceDesc: number;
  maxChunkSim: number;
  matchedChunks: number;
  finalScore: number;
}

export interface AdjudicationResult {
  recommend: boolean;
  fitScore: number;
  preferenceViolations: string[];
  strengths: string[];
  gaps: string[];
  seniorityFit: string;
}

export const CHUNK_SIM_THRESHOLD = 0.55;
export const MIN_MATCHED_CHUNKS = 2;
export const FINAL_SCORE_FLOOR = 0.55;

export const SECTION_RESUME = "resume";
export const SECTION_SKILLS = "skills";
export const SECTION_TARGETS = "targets";
export const SECTION_EXPERIENCE = "experience";
export const SECTION_PROJECTS = "projects";
export const SECTION_CONSTRAINTS = "constraints";

export const JOB_POSTING = "posting_core";
export const JOB_REQUIREMENTS = "requirements";

export function buildUserPreferences(profile: Record<string, unknown>): UserPreferences {
  const dealSlugs = (profile.selectedDealbreakerSlugs as string[] | undefined) ?? [];
  const dealbreakerLabels = dealSlugs
    .filter((s) => s && s !== "db_other")
    .map((s) => labelForSlug(s));

  const needsVisa =
    Boolean(profile.needsVisaSponsorship) || profile.visaStatus === "need_sponsorship";

  const bullets: string[] = [];
  if (profile.workArrangement) {
    bullets.push(`Work arrangement: ${labelForSlug(String(profile.workArrangement))}`);
  }
  if (needsVisa) bullets.push("Requires visa sponsorship");
  if (profile.seniorityTarget) {
    bullets.push(
      `Minimum seniority: ${labelForSlug(String(profile.seniorityTarget))} (roles at or above this level are acceptable)`,
    );
  }
  if (profile.yearsExperience) bullets.push(`Years experience: ${profile.yearsExperience}`);
  if (!profile.openToContract) bullets.push("Not open to contract roles");
  for (const l of dealbreakerLabels) bullets.push(`Dealbreaker: ${l}`);
  if (profile.dealBreakersOtherNote) {
    bullets.push(`Dealbreaker note: ${profile.dealBreakersOtherNote}`);
  }

  return {
    workArrangement: String(profile.workArrangement ?? ""),
    region: String(profile.region ?? ""),
    timezone: String(profile.timezone ?? ""),
    needsVisaSponsorship: needsVisa,
    visaStatus: String(profile.visaStatus ?? ""),
    seniorityTarget: String(profile.seniorityTarget ?? ""),
    yearsExperience: String(profile.yearsExperience ?? ""),
    primaryDiscipline: String(profile.primaryDiscipline ?? ""),
    compensationBand: String(profile.compensationBand ?? ""),
    openToContract: Boolean(profile.openToContract),
    openToRelocate: Boolean(profile.openToRelocate),
    dealbreakerSlugs: [...dealSlugs],
    dealbreakersOtherNote: String(profile.dealBreakersOtherNote ?? ""),
    industrySlugs: (profile.selectedIndustrySlugs as string[] | undefined) ?? [],
    dealbreakerLabels,
    hardPreferenceBullets: bullets,
  };
}

export function extractJobFacts(
  title: string,
  company: string,
  location: string | null,
  description: string | null,
  formLabels: string[] = [],
): JobFacts {
  const loc = location ?? "";
  const desc = description ?? "";
  const combined = [title, company, loc, desc, ...formLabels].join("\n").toLowerCase();

  const industryTags: string[] = [];
  if (/\b(defense|military|dod|clearance)\b/.test(combined)) industryTags.push("defense");
  if (/\b(gambling|casino|sports betting)\b/.test(combined)) industryTags.push("gambling");
  if (/\b(crypto|web3|blockchain|defi)\b/.test(combined)) industryTags.push("crypto");
  if (/\b(adtech|surveillance)\b/.test(combined)) industryTags.push("ads");

  let remotePolicy = "unknown";
  if (/\b(remote|work from home|wfh|distributed)\b/.test(combined) || loc.toLowerCase().includes("remote")) {
    remotePolicy = /\bhybrid\b/.test(combined) ? "hybrid" : "remote";
  } else if (/\bhybrid\b/.test(combined)) {
    remotePolicy = "hybrid";
  } else if (/\b(on[- ]?site|in[- ]?office)\b/.test(combined)) {
    remotePolicy = "onsite";
  }

  const employmentType = /\b(contract|1099|c2c|freelance)\b/.test(combined) ? "contract" : "full_time";

  const seniorityPatterns: [string, RegExp][] = [
    ["intern", /\bintern\b/i],
    ["junior", /\b(junior|jr\.?|entry[- ]?level)\b/i],
    ["mid", /\bmid[- ]?level\b/i],
    ["senior", /\bsenior\b/i],
    ["staff", /\bstaff\b/i],
    ["principal", /\b(principal|distinguished)\b/i],
    ["lead", /\b(tech lead|team lead)\b/i],
    ["manager", /\bengineering manager\b/i],
    ["director", /\bdirector\b/i],
  ];
  let seniorityLevel = "unknown";
  for (const [level, re] of seniorityPatterns) {
    if (re.test(title) || re.test(desc)) {
      seniorityLevel = level;
      break;
    }
  }

  let requiresSponsorship: boolean | undefined;
  if (/(no (visa )?sponsorship|unable to sponsor|will not sponsor)/i.test(combined)) {
    requiresSponsorship = false;
  } else if (/(visa sponsorship|h-?1b|sponsor visa)/i.test(combined)) {
    requiresSponsorship = true;
  }

  return {
    remotePolicy,
    employmentType,
    seniorityLevel,
    requiresSponsorship,
    industryTags,
    hasHeavyOncall: /on[- ]?call|pager duty/i.test(combined),
    locationText: loc,
    title,
    company,
  };
}

const SENIORITY_RANK: Record<string, number> = {
  intern: 0, junior: 1, mid: 2, senior: 3, staff: 4, principal: 5, lead: 4, manager: 4, director: 6,
};

/** Target is a minimum: at-target is ideal, above is acceptable, below is rejected. */
export function compareSeniority(
  userTarget: string,
  jobLevel: string,
): { eligible: boolean; fit: "good" | "over" | "under" } {
  if (!userTarget || !jobLevel || jobLevel === "unknown") {
    return { eligible: true, fit: "good" };
  }
  const u = SENIORITY_RANK[userTarget];
  const j = SENIORITY_RANK[jobLevel];
  if (u === undefined || j === undefined) {
    return { eligible: true, fit: "good" };
  }
  if (j < u) return { eligible: false, fit: "under" };
  if (j === u) return { eligible: true, fit: "good" };
  return { eligible: true, fit: "over" };
}

function isSeniorityPreferenceViolation(v: string): boolean {
  const lower = v.toLowerCase();
  const keywords = [
    "seniority",
    "senior level",
    "mid-level",
    "mid level",
    "junior",
    "entry-level",
    "entry level",
    "target seniority",
    "minimum seniority",
    "below user target",
    "above user target",
    "stretch role",
  ];
  return keywords.some((k) => lower.includes(k));
}

function filterSeniorityPreferenceViolations(violations: string[]): string[] {
  return violations.filter((v) => !isSeniorityPreferenceViolation(v));
}

export function reconcileAdjudicationSeniority(
  prefs: UserPreferences,
  facts: JobFacts,
  adj: AdjudicationResult,
): AdjudicationResult {
  const { eligible, fit } = compareSeniority(prefs.seniorityTarget, facts.seniorityLevel);
  adj.seniorityFit = fit;

  if (!eligible) {
    adj.recommend = false;
    const msg = `Job seniority (${facts.seniorityLevel}) is below user target (${prefs.seniorityTarget})`;
    if (!adj.preferenceViolations.includes(msg)) {
      adj.preferenceViolations = [...adj.preferenceViolations, msg];
    }
    return adj;
  }

  adj.preferenceViolations = filterSeniorityPreferenceViolations(adj.preferenceViolations);
  adj.recommend = adj.preferenceViolations.length === 0;
  return adj;
}

export function matchEligible(prefs: UserPreferences, job: JobFacts): GateResult {
  const reasons: string[] = [];

  if (prefs.workArrangement === "remote" && job.remotePolicy === "onsite") {
    reasons.push("Job is onsite-only; user requires remote-first");
  }
  if (prefs.workArrangement === "hybrid" && job.remotePolicy === "onsite") {
    reasons.push("Job is onsite-only; user requires hybrid or remote");
  }
  if (prefs.needsVisaSponsorship && job.requiresSponsorship === false) {
    reasons.push("Job does not offer visa sponsorship; user requires sponsorship");
  }
  if (!prefs.openToContract && job.employmentType === "contract") {
    reasons.push("Job is contract; user is not open to contract");
  }

  const seniority = compareSeniority(prefs.seniorityTarget, job.seniorityLevel);
  if (!seniority.eligible) {
    reasons.push(
      `Job seniority (${job.seniorityLevel}) is below user target (${prefs.seniorityTarget})`,
    );
  }

  const combined = `${job.title} ${job.company}`.toLowerCase();
  for (const slug of prefs.dealbreakerSlugs) {
    if (slug === "db_no_defense" && (job.industryTags.includes("defense") || combined.includes("defense"))) {
      reasons.push("Dealbreaker: defense sector");
    }
    if (slug === "db_no_gambling" && job.industryTags.includes("gambling")) {
      reasons.push("Dealbreaker: gambling");
    }
    if (slug === "db_no_crypto" && job.industryTags.includes("crypto")) {
      reasons.push("Dealbreaker: crypto-first");
    }
    if (slug === "db_no_oncall" && job.hasHeavyOncall) {
      reasons.push("Dealbreaker: heavy on-call");
    }
    if (slug === "db_no_ads" && job.industryTags.includes("ads")) {
      reasons.push("Dealbreaker: ads/surveillance business");
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function sectionPrefixMatch(sectionKey: string, prefix: string): boolean {
  return sectionKey === prefix || sectionKey.startsWith(`${prefix}_`);
}

export function cosineSim(a: number[], b: number[]): number {
  if (a.length === 0 || b.length !== a.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function avg(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

function max(vals: number[]): number {
  return vals.length === 0 ? 0 : Math.max(...vals);
}

export function computeScoreBreakdown(
  userChunks: { sectionKey: string; embedding: number[] }[],
  jobSections: { sectionKey: string; embedding: number[] }[],
): ScoreBreakdown {
  const posting = jobSections.find((j) => j.sectionKey === JOB_POSTING)?.embedding ?? [];
  const reqs =
    jobSections.find((j) => j.sectionKey === JOB_REQUIREMENTS)?.embedding ?? posting;

  const resumeSims: number[] = [];
  const skillsSims: number[] = [];
  const targetsSims: number[] = [];
  const expSims: number[] = [];
  const allSims: number[] = [];
  let matchedAbove = 0;

  for (const uc of userChunks) {
    if (uc.sectionKey === SECTION_CONSTRAINTS) continue;
    for (const jv of jobSections) {
      const s = cosineSim(uc.embedding, jv.embedding);
      allSims.push(s);
      if (s > CHUNK_SIM_THRESHOLD) matchedAbove++;
    }
    if (sectionPrefixMatch(uc.sectionKey, SECTION_RESUME) && posting.length) {
      resumeSims.push(cosineSim(uc.embedding, posting));
    }
    if (uc.sectionKey === SECTION_SKILLS && reqs.length) {
      skillsSims.push(cosineSim(uc.embedding, reqs));
    }
    if (uc.sectionKey === SECTION_TARGETS && posting.length) {
      targetsSims.push(cosineSim(uc.embedding, posting));
    }
    if (
      (uc.sectionKey === SECTION_EXPERIENCE || sectionPrefixMatch(uc.sectionKey, SECTION_PROJECTS)) &&
      posting.length
    ) {
      expSims.push(cosineSim(uc.embedding, posting));
    }
  }

  const breakdown: ScoreBreakdown = {
    resumePosting: avg(resumeSims),
    skillsReqs: avg(skillsSims),
    targetsPosting: avg(targetsSims),
    experienceDesc: avg(expSims),
    maxChunkSim: max(allSims),
    matchedChunks: matchedAbove,
    finalScore: 0,
  };
  breakdown.finalScore =
    0.35 * breakdown.resumePosting +
    0.2 * breakdown.skillsReqs +
    0.15 * breakdown.targetsPosting +
    0.15 * breakdown.experienceDesc +
    0.15 * breakdown.maxChunkSim;
  return breakdown;
}

export function buildJobSections(
  title: string,
  company: string,
  location: string | null,
  description: string | null,
  formLabels: string[],
  facts: JobFacts,
): { sectionKey: string; content: string }[] {
  const posting = ["Title: " + title, "Company: " + company, location ? "Location: " + location : "", description ?? ""]
    .filter(Boolean)
    .join("\n");

  const desc = description ?? "";
  let reqs = desc;
  const lower = desc.toLowerCase();
  for (const m of ["requirements:", "qualifications:", "what you'll need"]) {
    const i = lower.indexOf(m);
    if (i >= 0) {
      reqs = desc.slice(i);
      break;
    }
  }

  const logistics = [
    facts.remotePolicy !== "unknown" ? `Work model: ${facts.remotePolicy}` : "",
    facts.employmentType ? `Employment: ${facts.employmentType}` : "",
    facts.seniorityLevel !== "unknown" ? `Seniority: ${facts.seniorityLevel}` : "",
    facts.requiresSponsorship === true ? "Visa sponsorship available" : "",
    facts.requiresSponsorship === false ? "No visa sponsorship" : "",
    facts.hasHeavyOncall ? "Heavy on-call expected" : "",
    facts.industryTags.length ? `Industry signals: ${facts.industryTags.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const sections: { sectionKey: string; content: string }[] = [];
  if (posting.trim()) sections.push({ sectionKey: JOB_POSTING, content: posting });
  if (reqs.trim()) sections.push({ sectionKey: JOB_REQUIREMENTS, content: reqs });
  if (logistics.trim()) sections.push({ sectionKey: "logistics", content: logistics });
  if (formLabels.length) {
    sections.push({ sectionKey: "form_fields", content: "Application form fields:\n" + formLabels.join("\n") });
  }
  return sections;
}

export const MATCH_TIER_STRONG = "strong";
export const MATCH_TIER_PROMISING = "promising";
export const MATCH_TIER_MODE_STRONG_ONLY = "strong_only";
export const MATCH_TIER_MODE_STRONG_AND_PROMISING = "strong_and_promising";
export const STRONG_MATCH_MIN_FIT_SCORE = 75;

export function normalizeMatchTierMode(mode?: string): string {
  return mode === MATCH_TIER_MODE_STRONG_ONLY
    ? MATCH_TIER_MODE_STRONG_ONLY
    : MATCH_TIER_MODE_STRONG_AND_PROMISING;
}

export function classifyMatchTier(
  matchScore: number | undefined,
  bd: ScoreBreakdown | null | undefined,
  adj: AdjudicationResult | null | undefined,
): string | null {
  const score =
    bd && bd.finalScore > 0
      ? Math.round(bd.finalScore * 100)
      : matchScore != null
        ? Math.round(matchScore * 100)
        : adj?.fitScore && adj.fitScore > 0
          ? adj.fitScore
          : null;
  if (score == null) return null;

  if (adj && !adj.recommend) return MATCH_TIER_PROMISING;
  if (adj && (adj.seniorityFit === "under" || adj.seniorityFit === "over")) {
    return MATCH_TIER_PROMISING;
  }
  return score >= STRONG_MATCH_MIN_FIT_SCORE ? MATCH_TIER_STRONG : MATCH_TIER_PROMISING;
}

export function matchPassesTierFilter(
  prefs: UserPreferences,
  matchScore: number,
  bd: ScoreBreakdown,
  adj: AdjudicationResult | null,
): boolean {
  if (normalizeMatchTierMode(prefs.matchTierMode) === MATCH_TIER_MODE_STRONG_AND_PROMISING) {
    return true;
  }
  return classifyMatchTier(matchScore, bd, adj) === MATCH_TIER_STRONG;
}
