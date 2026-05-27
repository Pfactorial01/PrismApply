import "dotenv/config";
import { fetchTailorInput, insertTailoredApplication } from "../db.js";
import { buildUserPreferences, extractJobFacts, matchEligible, type JobFacts } from "../matching/index.js";
import { uploadResumePdf } from "./uploadToR2.js";
import { runTailorPipeline } from "../tailoring/pipeline.js";
import { renderStructuredResumePdf } from "../tailoring/renderPdf.js";
import { classifyFormField } from "../tailoring/classifyField.js";
import type { TailorContext } from "../tailoring/types.js";

export interface TailorResult {
  matchId: number;
  pdfUrl: string;
  resumeFilename: string;
}

function resolveJobFacts(input: {
  jobTitle: string;
  jobCompany: string;
  jobLocation: string | null;
  jobDescription: string | null;
  jobSeniorityLevel: string | null;
  jobFactsJson: Record<string, unknown> | null;
}): JobFacts {
  const extracted = extractJobFacts(
    input.jobTitle,
    input.jobCompany,
    input.jobLocation,
    input.jobDescription,
    [],
  );
  if (input.jobFactsJson && typeof input.jobFactsJson === "object") {
    const stored = input.jobFactsJson as Partial<JobFacts>;
    return {
      ...extracted,
      ...stored,
      seniorityLevel: input.jobSeniorityLevel ?? stored.seniorityLevel ?? extracted.seniorityLevel,
      industryTags: stored.industryTags ?? extracted.industryTags,
    };
  }
  if (input.jobSeniorityLevel) {
    extracted.seniorityLevel = input.jobSeniorityLevel;
  }
  return extracted;
}

function injectResumePdfUrl(
  formAnswers: { label: string; value: string }[],
  formFields: { label: string; field_type: string }[],
  pdfUrl: string,
): { label: string; value: string }[] {
  const fileLabels = new Set(
    formFields
      .filter((f) => {
        const c = classifyFormField({
          ...f,
          required: false,
          options: null,
          position: 0,
        });
        return c.fieldClass === "file";
      })
      .map((f) => f.label),
  );

  return formAnswers.map((a) =>
    fileLabels.has(a.label) ? { ...a, value: pdfUrl } : a,
  );
}

export async function tailorForUser(matchId: number): Promise<TailorResult> {
  console.log(`  [tailor] matchId=${matchId}`);

  const input = await fetchTailorInput(matchId);
  if (!input || !input.profileJson) {
    throw new Error(`match ${matchId}: profile not found`);
  }
  console.log(`  [tailor] ${input.jobTitle} @ ${input.jobCompany}`);

  const prefs = buildUserPreferences(input.profileJson);
  const jobFacts = resolveJobFacts(input);

  const gate = matchEligible(prefs, jobFacts);
  if (!gate.ok) {
    throw new Error(
      `match ${matchId}: job violates user preferences (${gate.reasons.join("; ")})`,
    );
  }

  const ctx: TailorContext = {
    matchId: input.matchId,
    userId: input.userId,
    jobId: input.jobId,
    jobTitle: input.jobTitle,
    jobCompany: input.jobCompany,
    jobLocation: input.jobLocation,
    jobDescription: input.jobDescription,
    jobSeniorityLevel: input.jobSeniorityLevel,
    jobFacts,
    formFields: input.formFields,
    profileJson: input.profileJson,
    prefs,
  };

  const result = await runTailorPipeline(ctx);

  console.log(
    `  [tailor] resume=${result.plainTextResume.length}chars cover=${result.coverLetter.length}chars fields=${result.formAnswers.length} template=${result.templateId}`,
  );

  const pdfBuffer = await renderStructuredResumePdf(result.structuredResume, result.templateId);
  console.log(`  [tailor] pdf=${pdfBuffer.length}bytes`);

  const pdfUrl = await uploadResumePdf(input.userId, matchId, pdfBuffer);
  console.log(`  [tailor] uploaded: ${pdfUrl}`);

  const formAnswers = injectResumePdfUrl(
    result.formAnswers.map(({ label, value }) => ({ label, value })),
    input.formFields,
    pdfUrl,
  );

  await insertTailoredApplication(
    matchId,
    input.userId,
    input.jobId,
    result.plainTextResume,
    result.coverLetter,
    formAnswers,
    pdfUrl,
    {
      resumeFilename: result.resumeFilename,
      structuredResume: result.structuredResume,
      metadata: result.metadata,
    },
  );
  console.log(`  [tailor] stored in DB citedFields=${result.metadata.citedFields.join(",")}`);

  return { matchId, pdfUrl, resumeFilename: result.resumeFilename };
}
