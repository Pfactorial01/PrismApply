import type { FormFieldRow } from "../db.js";
import type { ClassifiedField, FieldClass } from "./types.js";

const IDENTITY_PATTERNS = [
  /\bname\b/i,
  /\bfull name\b/i,
  /\bfirst name\b/i,
  /\blast name\b/i,
  /\bemail\b/i,
  /\bphone\b/i,
  /\blinkedin\b/i,
  /\bgithub\b/i,
  /\bportfolio\b/i,
  /\bwebsite\b/i,
  /\burl\b/i,
];

const FILE_PATTERNS = [/\bresume\b/i, /\bcv\b/i, /\bcurriculum vitae\b/i, /\battach\b.*\bfile\b/i];

const EEO_PATTERNS = [
  /\bgender\b/i,
  /\brace\b/i,
  /\bethnic/i,
  /\bveteran\b/i,
  /\bdisabilit/i,
  /\bsexual orientation\b/i,
  /\bpronoun/i,
  /\beeo\b/i,
  /\bvoluntary self/i,
];

const LOCATION_PATTERNS = [
  /\blocation\b/i,
  /\bcity\b/i,
  /\bstate\b/i,
  /\bcountry\b/i,
  /\bzip\b/i,
  /\bpostal\b/i,
  /\bremote\b/i,
  /\brelocation\b/i,
  /\bcommute\b/i,
  /\bdays?\s+(in|at|on)\s+office\b/i,
  /\bwork authorization\b/i,
  /\bauthorized to work\b/i,
  /\blegal.*work\b/i,
];

const BEHAVIORAL_PATTERNS = [
  /\bwhy\b.*\b(company|us|this role|delete|join)\b/i,
  /\bdescribe a time\b/i,
  /\btell us about\b/i,
  /\bexample of\b/i,
  /\bexperience with\b/i,
  /\bwhat interests you\b/i,
  /\bwhat motivates\b/i,
  /\bcover letter\b/i,
  /\badditional information\b/i,
  /\banything else\b/i,
];

export function classifyFormField(field: FormFieldRow): ClassifiedField {
  const label = field.label.trim();
  const ft = field.field_type.toLowerCase();

  if (ft === "file" || FILE_PATTERNS.some((p) => p.test(label))) {
    return { ...field, fieldClass: "file" };
  }

  if (EEO_PATTERNS.some((p) => p.test(label))) {
    return { ...field, fieldClass: "eeo" };
  }

  if (IDENTITY_PATTERNS.some((p) => p.test(label))) {
    return { ...field, fieldClass: "identity" };
  }

  if (ft === "select" || ft === "radio" || ft === "checkbox") {
    return { ...field, fieldClass: "select" };
  }

  if (LOCATION_PATTERNS.some((p) => p.test(label))) {
    return { ...field, fieldClass: "location" };
  }

  if (BEHAVIORAL_PATTERNS.some((p) => p.test(label)) || ft === "textarea") {
    if (BEHAVIORAL_PATTERNS.some((p) => p.test(label))) {
      return { ...field, fieldClass: "behavioral" };
    }
    return { ...field, fieldClass: "long_text" };
  }

  if (ft === "textarea") {
    return { ...field, fieldClass: "long_text" };
  }

  return { ...field, fieldClass: "short_text" };
}

export function classifyFormFields(fields: FormFieldRow[]): ClassifiedField[] {
  return fields.map(classifyFormField);
}

export function groupFieldsByClass(fields: ClassifiedField[]): Map<FieldClass, ClassifiedField[]> {
  const map = new Map<FieldClass, ClassifiedField[]>();
  for (const f of fields) {
    const list = map.get(f.fieldClass) ?? [];
    list.push(f);
    map.set(f.fieldClass, list);
  }
  return map;
}
