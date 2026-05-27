import { extractJdRequirements } from "./extractJdRequirements.js";
import { buildEvidenceMap } from "./buildEvidenceMap.js";
import { writeStructuredResume } from "./writeResume.js";
import { validateStructuredResume, mergeMetadataCitations } from "./validateResume.js";
import { writeCoverLetter } from "./writeCoverLetter.js";
import { classifyFormFields } from "./classifyField.js";
import { answerFormFields, orderFormAnswers } from "./answerFormFields.js";
import { pickTemplateId } from "./templateId.js";
import { buildResumeFilename } from "./filename.js";
import { structuredResumeToPlainText } from "./structuredToPlainText.js";
import type { TailorContext, TailorPipelineResult, TailorMetadata } from "./types.js";
import {
  getJdRequirements,
  upsertJdRequirements,
  getProfileEmbeddingSections,
} from "../db.js";

export async function runTailorPipeline(ctx: TailorContext): Promise<TailorPipelineResult> {
  console.log(`  [tailor-pipeline] stage 1: JD requirements jobId=${ctx.jobId}`);

  let jd = await getJdRequirements(ctx.jobId);
  if (!jd) {
    jd = await extractJdRequirements({
      title: ctx.jobTitle,
      company: ctx.jobCompany,
      location: ctx.jobLocation,
      description: ctx.jobDescription,
      jobFacts: ctx.jobFacts,
    });
    await upsertJdRequirements(ctx.jobId, jd);
    console.log(`  [tailor-pipeline] JD requirements extracted and cached`);
  } else {
    console.log(`  [tailor-pipeline] JD requirements loaded from cache`);
  }

  console.log(`  [tailor-pipeline] stage 2: evidence map`);
  const embeddingSections = await getProfileEmbeddingSections(ctx.userId, ctx.jobId, 15);
  const evidence = buildEvidenceMap(ctx.profileJson, jd, embeddingSections);

  console.log(`  [tailor-pipeline] stage 3a: resume writer`);
  let structuredResume = await writeStructuredResume({
    jobTitle: ctx.jobTitle,
    jobCompany: ctx.jobCompany,
    jd,
    evidence,
  });

  let validation = validateStructuredResume(structuredResume);
  if (!validation.ok) {
    console.warn(`  [tailor-pipeline] resume validation failed, retrying: ${validation.warnings.join("; ")}`);
    structuredResume = await writeStructuredResume({
      jobTitle: ctx.jobTitle,
      jobCompany: ctx.jobCompany,
      jd,
      evidence,
      retryNotes: validation.warnings,
    });
    validation = validateStructuredResume(structuredResume);
  }

  const templateId = pickTemplateId(ctx.userId, ctx.jobId);
  const metadata: TailorMetadata = {
    citedFields: validation.citedFields,
    templateId,
    lowConfidenceFields: [],
    validationWarnings: validation.warnings,
  };

  console.log(`  [tailor-pipeline] stage 3b: cover letter`);
  const cover = await writeCoverLetter({
    jobTitle: ctx.jobTitle,
    jobCompany: ctx.jobCompany,
    jd,
    evidence,
  });
  mergeMetadataCitations(metadata, cover.citedFields);

  console.log(`  [tailor-pipeline] stage 3c: form fields (${ctx.formFields.length} fields)`);
  const classified = classifyFormFields(ctx.formFields);
  const formAnswersRaw = await answerFormFields({
    fields: classified,
    profileJson: ctx.profileJson,
    evidence,
    jd,
    jobCompany: ctx.jobCompany,
  });
  const formAnswers = orderFormAnswers(formAnswersRaw, classified);
  metadata.lowConfidenceFields = formAnswers
    .filter((a) => a.lowConfidence && a.value.trim())
    .map((a) => a.label);

  for (const a of formAnswers) {
    for (const ref of a.sourceRefs ?? []) {
      if (ref.field) metadata.citedFields.push(ref.field);
    }
  }
  metadata.citedFields = [...new Set(metadata.citedFields)];

  const plainTextResume = structuredResumeToPlainText(structuredResume);
  const fullName =
    (ctx.profileJson.fullName as string) ||
    structuredResume.name ||
    "Applicant";
  const resumeFilename = buildResumeFilename({
    fullName,
    company: ctx.jobCompany,
    roleTitle: ctx.jobTitle,
  });

  console.log(
    `  [tailor-pipeline] complete citedFields=${metadata.citedFields.length} template=${templateId} filename=${resumeFilename}`,
  );

  return {
    structuredResume,
    plainTextResume,
    coverLetter: cover.coverLetter,
    formAnswers,
    templateId,
    resumeFilename,
    metadata,
  };
}
