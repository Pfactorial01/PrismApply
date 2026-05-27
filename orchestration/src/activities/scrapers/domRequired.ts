import type { FormFieldPayload } from "../../discovery/types.js";

export interface DomRequiredHint {
  label: string;
  required: boolean;
}

/** Normalize label text for fuzzy matching (strip asterisks, collapse whitespace). */
export function normalizeFieldLabel(label: string): string {
  return label
    .replace(/[*✱]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function mergeRequiredFlags(
  fields: FormFieldPayload[],
  domHints: DomRequiredHint[],
): FormFieldPayload[] {
  if (domHints.length === 0) return fields;

  const hintByNorm = new Map<string, boolean>();
  for (const hint of domHints) {
    const key = normalizeFieldLabel(hint.label);
    hintByNorm.set(key, (hintByNorm.get(key) ?? false) || hint.required);
  }

  return fields.map((field) => {
    const n = normalizeFieldLabel(field.label);
    let required = field.required;

    if (hintByNorm.has(n)) {
      required = hintByNorm.get(n)!;
    } else {
      for (const [hintNorm, hintRequired] of hintByNorm) {
        if (n.includes(hintNorm) || hintNorm.includes(n)) {
          required = hintRequired;
          break;
        }
      }
    }

    return { ...field, required };
  });
}
