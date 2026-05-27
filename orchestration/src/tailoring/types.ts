import type { FormFieldRow } from "../db.js";
import type { JobFacts, UserPreferences } from "../matching/index.js";

export interface SourceRef {
  field: string;
  excerpt: string;
}

export interface ResumeBullet {
  text: string;
  sourceRefs: SourceRef[];
}

export interface ResumeExperience {
  company: string;
  role: string;
  location?: string;
  dates?: string;
  bullets: ResumeBullet[];
}

export interface ResumeProject {
  title: string;
  bullets: ResumeBullet[];
}

export interface StructuredResume {
  name: string;
  contact: string[];
  summary?: string;
  skills: { category: string; items: string[] }[];
  experience: ResumeExperience[];
  projects?: ResumeProject[];
  education?: string[];
}

export interface JdRequirements {
  roleTitleVariants: string[];
  seniority: string;
  locationPolicy: string;
  mustHaveSkills: string[];
  niceToHaveSkills: string[];
  responsibilityThemes: string[];
  atsKeywords: string[];
  stack: string[];
}

export interface EvidenceItem {
  requirement: string;
  requirementType: "must_have" | "nice_to_have" | "theme" | "keyword";
  evidence: { sourceField: string; excerpt: string; relevanceScore: number }[];
}

import type { ResumeDensityHints, ExpandFieldHint } from "./resumeDensity.js";

export interface EvidenceMap {
  identity: Record<string, string>;
  items: EvidenceItem[];
  profileSections: { key: string; content: string; score?: number }[];
  densityHints: ResumeDensityHints;
  expandFrom: ExpandFieldHint[];
}

export type ResumeTemplateId = "classic" | "modern" | "compact" | "minimal" | "ats";

export type FieldClass =
  | "identity"
  | "file"
  | "select"
  | "location"
  | "short_text"
  | "long_text"
  | "behavioral"
  | "eeo";

export interface ClassifiedField extends FormFieldRow {
  fieldClass: FieldClass;
}

export interface FormFieldAnswer {
  label: string;
  value: string;
  lowConfidence?: boolean;
  sourceRefs?: SourceRef[];
}

export interface TailorMetadata {
  citedFields: string[];
  templateId: ResumeTemplateId;
  lowConfidenceFields: string[];
  validationWarnings: string[];
}

export interface TailorContext {
  matchId: number;
  userId: string;
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  jobLocation: string | null;
  jobDescription: string | null;
  jobSeniorityLevel: string | null;
  jobFacts: JobFacts;
  formFields: FormFieldRow[];
  profileJson: Record<string, unknown>;
  prefs: UserPreferences;
}

export interface TailorPipelineResult {
  structuredResume: StructuredResume;
  plainTextResume: string;
  coverLetter: string;
  formAnswers: FormFieldAnswer[];
  templateId: ResumeTemplateId;
  resumeFilename: string;
  metadata: TailorMetadata;
}
