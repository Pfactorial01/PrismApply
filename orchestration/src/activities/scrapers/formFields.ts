import { z } from "zod";
import type { Stagehand } from "@browserbasehq/stagehand";
import type { FormFieldPayload } from "../../discovery/types.js";
import {
  mergeRequiredFlags,
  type DomRequiredHint,
} from "./domRequired.js";

const formFieldItemSchema = z.object({
  position: z
    .number()
    .describe("1-based order of appearance from top to bottom on the form"),
  label: z.string().describe("the field label text without asterisks"),
  type: z
    .enum(["text", "email", "tel", "file", "select", "textarea", "checkbox", "radio", "unknown"])
    .describe("the input field type"),
  required: z
    .boolean()
    .describe(
      "true if the field shows a required indicator (asterisk ✱, required attribute, aria-required, or Required text)",
    ),
  options: z
    .array(z.string())
    .nullable()
    .optional()
    .describe("dropdown/radio options if applicable, null otherwise"),
});

const formFieldsSchema = z.object({
  fields: z.array(formFieldItemSchema),
});

const simpleFormFieldItemSchema = z.object({
  position: z.number().optional(),
  label: z.string(),
  type: z.string(),
  required: z.boolean().optional(),
});

const simpleFormFieldsSchema = z.object({
  fields: z.array(simpleFormFieldItemSchema),
});

const EXTRACT_INSTRUCTION =
  "extract all form fields from this job application form in top-to-bottom visual order. Return a `fields` array. Include every input, select, textarea, file upload, checkbox, and radio button group. For each field set position (1 for the first field on the page, 2 for the next, etc.), label text (without asterisks), input type, required (true if label has ✱/asterisk or input has required/aria-required), and dropdown/radio options when applicable";

function normalizeFields(
  raw: Array<{
    position?: number;
    label: string;
    type: string;
    required?: boolean;
    options?: string[] | null;
  }>,
): FormFieldPayload[] {
  const withPos = raw.map((f, i) => ({
    position: f.position ?? i + 1,
    label: f.label.replace(/[*✱]+/g, "").replace(/\s+/g, " ").trim(),
    type: f.type ?? "unknown",
    required: f.required ?? false,
    options: f.options ?? undefined,
  }));
  withPos.sort((a, b) => a.position - b.position);
  return withPos.map(({ label, type, required, options }) => ({
    label,
    type,
    required,
    options,
  }));
}

async function readDomRequiredHints(stagehand: Stagehand): Promise<DomRequiredHint[]> {
  const page = stagehand.context.pages()[0];
  try {
    return await page.evaluate(() => {
      const norm = (s: string) =>
        s
          .replace(/[*✱]+/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const results: { label: string; required: boolean }[] = [];
      const seen = new Set<string>();

      const cleanLabel = (raw: string) =>
        raw.replace(/[*✱]+/g, "").replace(/\s+/g, " ").trim();

      const isRequired = (container: Element | null, control?: Element | null): boolean => {
        if (control) {
          if (control.hasAttribute("required")) return true;
          if (control.getAttribute("aria-required") === "true") return true;
        }
        if (!container) return false;

        if (
          container.querySelector(
            ".required, .asterisk, .required-field, [class*='required-mark'], [class*='RequiredIndicator']",
          )
        ) {
          return true;
        }

        const labelEl = container.querySelector(
          "label, legend, .application-label, .label, h3, h4, .text",
        );
        const labelText = (labelEl?.textContent ?? "").trim();
        if (/[*✱]/.test(labelText)) return true;
        if (/\(required\)/i.test(labelText)) return true;
        if (container.getAttribute("aria-required") === "true") return true;

        return false;
      };

      const addField = (rawLabel: string, required: boolean) => {
        const label = cleanLabel(rawLabel);
        const key = norm(label);
        if (!key || seen.has(key)) return;
        seen.add(key);
        results.push({ label, required });
      };

      const forms = Array.from(document.querySelectorAll("form"));
      const roots = forms.length > 0 ? forms : [document.body];

      for (const form of roots) {
        form.querySelectorAll(".application-question, .application-field").forEach((block) => {
          const labelEl = block.querySelector(".application-label, label, h4, .text");
          const label = labelEl?.textContent?.trim() ?? "";
          const control = block.querySelector("input, textarea, select");
          if (label) addField(label, isRequired(block, control));
        });

        form
          .querySelectorAll("fieldset, [role='radiogroup'], [role='group'], .radio-group")
          .forEach((group) => {
            const legend = group.querySelector("legend, label, .application-label, .label");
            const label = legend?.textContent?.trim() ?? "";
            const anyRequired = Array.from(
              group.querySelectorAll("input, textarea, select"),
            ).some((el) => isRequired(group, el));
            if (label) addField(label, isRequired(group) || anyRequired);
          });

        form.querySelectorAll(".field").forEach((field) => {
          if (field.classList.contains("hidden-field")) return;
          const labelEl = field.querySelector("label, legend");
          const label = labelEl?.textContent?.trim() ?? "";
          const control = field.querySelector("input, textarea, select");
          if (label) addField(label, isRequired(field, control));
        });

        form
          .querySelectorAll(
            "input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select",
          )
          .forEach((el) => {
            const type = (el as HTMLInputElement).type?.toLowerCase() ?? "";
            if (type === "radio" || type === "checkbox") return;

            let label = "";
            const htmlEl = el as HTMLElement;
            if (htmlEl.id) {
              const lbl = form.querySelector(`label[for="${CSS.escape(htmlEl.id)}"]`);
              label = lbl?.textContent?.trim() ?? "";
            }
            if (!label) {
              const parent = el.closest(
                ".application-question, .application-field, .field, li, .form-group, div",
              );
              label =
                parent
                  ?.querySelector("label, legend, .application-label, .label")
                  ?.textContent?.trim() ??
                el.getAttribute("aria-label") ??
                "";
            }
            if (label) {
              addField(
                label,
                isRequired(
                  el.closest(".application-question, .application-field, .field, li") ??
                    el.parentElement,
                  el,
                ),
              );
            }
          });
      }

      return results;
    });
  } catch (err) {
    console.warn("[extractFormFields] DOM required scan failed:", err);
    return [];
  }
}

async function finalizeFields(
  stagehand: Stagehand,
  fields: FormFieldPayload[],
): Promise<FormFieldPayload[]> {
  const domHints = await readDomRequiredHints(stagehand);
  const merged = mergeRequiredFlags(fields, domHints);
  const requiredCount = merged.filter((f) => f.required).length;
  console.log(
    `[extractFormFields] ${merged.length} fields, ${requiredCount} required (DOM hints: ${domHints.length})`,
  );
  return merged;
}

export async function extractFormFields(stagehand: Stagehand): Promise<FormFieldPayload[]> {
  try {
    const result = await stagehand.extract(EXTRACT_INSTRUCTION, formFieldsSchema);

    if (!result?.fields || !Array.isArray(result.fields)) {
      return finalizeFields(stagehand, await fallbackExtractFormFields(stagehand));
    }

    return finalizeFields(stagehand, normalizeFields(result.fields));
  } catch {
    return finalizeFields(stagehand, await fallbackExtractFormFields(stagehand));
  }
}

async function fallbackExtractFormFields(stagehand: Stagehand): Promise<FormFieldPayload[]> {
  try {
    const result = await stagehand.extract(
      "list all form fields visible on this page in top-to-bottom order. Return a `fields` array with position, label, type, and required for each field",
      simpleFormFieldsSchema,
    );

    if (!result?.fields || !Array.isArray(result.fields)) {
      return [];
    }

    return normalizeFields(
      result.fields.map((f) => ({
        position: f.position,
        label: f.label,
        type: f.type,
        required: f.required ?? false,
      })),
    );
  } catch {
    return [];
  }
}

export const jobDetailsSchema = z.object({
  title: z.string().describe("the job title"),
  company: z.string().describe("the company name"),
  location: z.string().nullable().describe("the job location, or null if not shown"),
  description: z
    .string()
    .nullable()
    .describe("the complete job description text from the listing page, including all sections"),
});
