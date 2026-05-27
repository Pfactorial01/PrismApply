import type { ResumeTemplateId } from "./types.js";

const TEMPLATES: ResumeTemplateId[] = ["classic", "modern", "compact", "minimal", "ats"];

/** Stable template per user+job pair (same application always same look). */
export function pickTemplateId(userId: string, jobId: string): ResumeTemplateId {
  const seed = `${userId}:${jobId}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TEMPLATES[hash % TEMPLATES.length]!;
}
