import type { StructuredResume, TailorMetadata } from "./types.js";
import {
  MIN_BULLETS_MOST_RECENT_ROLE,
  MIN_BULLETS_OTHER_ROLE,
  MIN_BULLETS_PER_PROJECT,
} from "./resumeDensity.js";

export interface ValidationResult {
  ok: boolean;
  warnings: string[];
  citedFields: string[];
}

export function validateStructuredResume(resume: StructuredResume): ValidationResult {
  const warnings: string[] = [];
  const citedFields = new Set<string>();

  if (!resume.name.trim()) {
    warnings.push("Missing name");
  }
  if (resume.contact.length === 0) {
    warnings.push("Missing contact info");
  }
  if (resume.experience.length === 0 && (resume.projects?.length ?? 0) === 0) {
    warnings.push("No experience or projects");
  }

  for (let i = 0; i < resume.experience.length; i++) {
    const exp = resume.experience[i];
    if (!exp.company.trim()) warnings.push("Experience entry missing company");
    if (!exp.role.trim()) warnings.push("Experience entry missing role");
    const minBullets = i === 0 ? MIN_BULLETS_MOST_RECENT_ROLE : MIN_BULLETS_OTHER_ROLE;
    if (exp.bullets.length < minBullets) {
      warnings.push(
        `${exp.company.trim() || "Most recent role"} needs at least ${minBullets} bullets (has ${exp.bullets.length})`,
      );
    }
    for (const b of exp.bullets) {
      if (!b.text.trim()) warnings.push("Empty bullet");
      if (b.sourceRefs.length === 0) {
        warnings.push(`Bullet without sourceRef: "${b.text.slice(0, 40)}..."`);
      } else {
        for (const ref of b.sourceRefs) citedFields.add(ref.field);
      }
    }
  }

  for (const proj of resume.projects ?? []) {
    if (!proj.title.trim()) continue;
    if (proj.bullets.length < MIN_BULLETS_PER_PROJECT) {
      warnings.push(
        `Project "${proj.title}" needs at least ${MIN_BULLETS_PER_PROJECT} bullets (has ${proj.bullets.length})`,
      );
    }
    for (const b of proj.bullets) {
      if (!b.text.trim()) warnings.push("Empty project bullet");
      if (b.sourceRefs.length === 0) {
        warnings.push(`Project bullet without sourceRef: "${b.text.slice(0, 40)}..."`);
      } else {
        for (const ref of b.sourceRefs) citedFields.add(ref.field);
      }
    }
  }

  return {
    ok: warnings.filter((w) => !w.includes("sourceRef")).length === 0,
    warnings,
    citedFields: [...citedFields],
  };
}

export function mergeMetadataCitations(
  metadata: TailorMetadata,
  citedFields: string[],
): TailorMetadata {
  const merged = new Set([...metadata.citedFields, ...citedFields]);
  return { ...metadata, citedFields: [...merged] };
}
