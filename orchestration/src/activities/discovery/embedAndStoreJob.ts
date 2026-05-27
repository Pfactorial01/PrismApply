import "dotenv/config";
import OpenAI from "openai";
import { discoveryConfig } from "../../config/discovery.js";
import { insertDiscoveredJobWithFields, replaceJobEmbeddingSections } from "../../discovery/db.js";
import {
  buildJobSections,
  extractJobFacts,
  type JobFacts,
} from "../../matching/index.js";
import type { DiscoveredJobPayload, EmbedStoreResult } from "../../discovery/types.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await openai.embeddings.create({
    model: discoveryConfig.embeddingModel,
    input: texts,
  });
  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function embedAndStoreJob(
  job: DiscoveredJobPayload,
): Promise<EmbedStoreResult> {
  const formLabels = job.formFields.map((f) => f.label);
  const facts: JobFacts = extractJobFacts(
    job.title,
    job.company,
    job.location,
    job.description,
    formLabels,
  );

  const legacyText = [job.title, job.company, job.location ?? "", job.description ?? ""]
    .filter(Boolean)
    .join("\n");

  const sections = buildJobSections(
    job.title,
    job.company,
    job.location,
    job.description,
    formLabels,
    facts,
  );

  console.log(
    `[embedAndStoreJob] "${job.title}" sections=${sections.length} remote=${facts.remotePolicy} seniority=${facts.seniorityLevel}`,
  );

  const sectionEmbeddings = sections.length > 0 ? await embedTexts(sections.map((s) => s.content)) : [];
  const legacyEmbedding =
    legacyText.trim() && sectionEmbeddings.length === 0
      ? (await embedTexts([legacyText]))[0] ?? null
      : sectionEmbeddings.find((_, i) => sections[i]?.sectionKey === "posting_core")
        ? sectionEmbeddings[sections.findIndex((s) => s.sectionKey === "posting_core")]
        : sectionEmbeddings[0] ?? null;

  const jobId = await insertDiscoveredJobWithFields(job, legacyEmbedding, facts);
  if (sections.length > 0 && sectionEmbeddings.length === sections.length) {
    await replaceJobEmbeddingSections(
      jobId,
      sections.map((s, i) => ({
        sectionKey: s.sectionKey,
        content: s.content,
        embedding: sectionEmbeddings[i]!,
      })),
    );
  }

  console.log(`[embedAndStoreJob] stored jobId=${jobId}`);
  return { jobId, isNew: true };
}
