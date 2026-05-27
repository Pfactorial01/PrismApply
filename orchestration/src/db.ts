import "dotenv/config";
import pg from "pg";
import type { AdjudicationResult, GateResult, JobFacts, ScoreBreakdown } from "./matching/index.js";
import type { JdRequirements, StructuredResume, TailorMetadata } from "./tailoring/types.js";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

// ── Matching v2 ─────────────────────────────────────────────

export interface JobForMatch {
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  formLabels: string[];
  embedding: number[] | null;
  jobFactsJson: JobFacts | null;
}

export async function getJobForMatch(jobId: string): Promise<JobForMatch | null> {
  const res = await pool.query(
    `SELECT title, company, location, description, embedding::text, job_facts_json
     FROM discovered_jobs WHERE id = $1`,
    [jobId],
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  const fieldsRes = await pool.query(
    `SELECT label FROM job_form_fields WHERE job_id = $1 ORDER BY position`,
    [jobId],
  );
  let embedding: number[] | null = null;
  if (row.embedding) {
    const parts = (row.embedding as string).slice(1, -1).split(",").filter(Boolean);
    embedding = parts.map((p: string) => Number.parseFloat(p.trim()));
  }
  let jobFactsJson: JobFacts | null = null;
  if (row.job_facts_json) {
    jobFactsJson = row.job_facts_json as JobFacts;
  }
  return {
    title: row.title,
    company: row.company,
    location: row.location,
    description: row.description,
    formLabels: fieldsRes.rows.map((r) => r.label as string),
    embedding,
    jobFactsJson,
  };
}

export interface UserForMatch {
  userId: string;
  profileJson: Record<string, unknown>;
  preferencesJson: Record<string, unknown> | null;
}

export async function getUserProfilesForMatching(): Promise<UserForMatch[]> {
  const res = await pool.query(
    `SELECT up.user_id::text, up.profile, up.preferences_json
     FROM user_profiles up
     WHERE EXISTS (
       SELECT 1 FROM profile_embedding_chunks pec WHERE pec.user_id = up.user_id
     )`,
  );
  return res.rows.map((r) => ({
    userId: r.user_id,
    profileJson: r.profile as Record<string, unknown>,
    preferencesJson: r.preferences_json as Record<string, unknown> | null,
  }));
}

export async function getUserSectionEmbeddings(
  userId: string,
): Promise<Array<{ sectionKey: string; embedding: number[] }>> {
  const res = await pool.query(
    `SELECT section_key, embedding::text FROM profile_embedding_chunks WHERE user_id = $1`,
    [userId],
  );
  return res.rows.map((r) => ({
    sectionKey: r.section_key as string,
    embedding: parseVector(r.embedding as string),
  }));
}

export async function getJobSectionEmbeddings(
  jobId: string,
): Promise<Array<{ sectionKey: string; embedding: number[] }>> {
  const res = await pool.query(
    `SELECT section_key, embedding::text FROM job_embedding_sections WHERE job_id = $1`,
    [jobId],
  );
  return res.rows.map((r) => ({
    sectionKey: r.section_key as string,
    embedding: parseVector(r.embedding as string),
  }));
}

function parseVector(raw: string): number[] {
  const parts = raw.slice(1, -1).split(",").filter(Boolean);
  return parts.map((p) => Number.parseFloat(p.trim()));
}

export async function insertJobMatchV2(
  userId: string,
  jobId: string,
  score: number,
  matchedChunks: number,
  gate: GateResult,
  breakdown: ScoreBreakdown,
  adjudication: AdjudicationResult | null,
): Promise<number | null> {
  const matchReason = {
    gate,
    direction: "forward",
    strengths: adjudication?.strengths ?? [],
    gaps: adjudication?.gaps ?? [],
  };
  const res = await pool.query(
    `INSERT INTO job_matches (user_id, job_id, score, matched_chunks, status, gate_passed, score_breakdown, match_reason, adjudication)
     VALUES ($1, $2, $3, $4, 'pending', true, $5::jsonb, $6::jsonb, $7::jsonb)
     ON CONFLICT (user_id, job_id) DO NOTHING
     RETURNING id`,
    [
      userId,
      jobId,
      score,
      matchedChunks,
      JSON.stringify(breakdown),
      JSON.stringify(matchReason),
      adjudication ? JSON.stringify(adjudication) : null,
    ],
  );
  return res.rows[0]?.id ?? null;
}

// ── Matching (legacy helpers) ──────────────────────────────

export interface MatchedUser {
  userId: string;
  matchedChunks: number;
  avgScore: number;
}

export async function findMatchingUsers(
  jobEmbedding: number[],
  threshold = 0.55,
  limit = 50,
): Promise<MatchedUser[]> {
  const lit = `[${jobEmbedding.join(",")}]`;
  const res = await pool.query(
    `SELECT pec.user_id::text,
            COUNT(*)::int AS matched_chunks,
            AVG(1 - (pec.embedding <=> $1::vector))::float8 AS avg_similarity
     FROM profile_embedding_chunks pec
     WHERE 1 - (pec.embedding <=> $1::vector) > $2
     GROUP BY pec.user_id
     ORDER BY avg_similarity DESC
     LIMIT $3`,
    [lit, threshold, limit],
  );
  return res.rows.map((r) => ({
    userId: r.user_id,
    matchedChunks: r.matched_chunks,
    avgScore: r.avg_similarity,
  }));
}

export async function getJobEmbedding(jobId: string): Promise<number[] | null> {
  const res = await pool.query(
    `SELECT embedding::text FROM discovered_jobs WHERE id = $1 AND embedding IS NOT NULL`,
    [jobId],
  );
  if (res.rows.length === 0) return null;
  const raw = res.rows[0].embedding as string;
  const parts = raw.slice(1, -1).split(",").filter(Boolean);
  return parts.map((p) => Number.parseFloat(p.trim()));
}

export async function insertJobMatch(
  userId: string,
  jobId: string,
  score: number,
  matchedChunks: number,
): Promise<number> {
  const res = await pool.query(
    `INSERT INTO job_matches (user_id, job_id, score, matched_chunks, status)
     VALUES ($1, $2, $3, $4, 'pending')
     ON CONFLICT (user_id, job_id) DO NOTHING
     RETURNING id`,
    [userId, jobId, score, matchedChunks],
  );
  return res.rows[0]?.id ?? null;
}

// ── Tailoring ─────────────────────────────────────────────

export interface TailorInput {
  matchId: number;
  userId: string;
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  jobLocation: string | null;
  jobDescription: string | null;
  jobSeniorityLevel: string | null;
  jobFactsJson: Record<string, unknown> | null;
  formFields: FormFieldRow[];
  profileJson: Record<string, unknown>;
  relevantChunks: ChunkRow[];
}

export interface FormFieldRow {
  label: string;
  field_type: string;
  required: boolean;
  options: string[] | null;
  position: number;
}

export interface ChunkRow {
  content: string;
  similarity: number;
}

export async function fetchTailorInput(matchId: number): Promise<TailorInput | null> {
  const matchRes = await pool.query(
    `SELECT id, user_id::text, job_id::text FROM job_matches WHERE id = $1`,
    [matchId],
  );
  if (matchRes.rows.length === 0) return null;
  const { user_id: userId, job_id: jobId } = matchRes.rows[0];

  const jobRes = await pool.query(
    `SELECT title, company, location, description, seniority_level, job_facts_json
     FROM discovered_jobs WHERE id = $1`,
    [jobId],
  );
  if (jobRes.rows.length === 0) return null;
  const job = jobRes.rows[0];

  const fieldsRes = await pool.query(
    `SELECT label, field_type, required, options, position FROM job_form_fields WHERE job_id = $1 ORDER BY position`,
    [jobId],
  );

  const profileRes = await pool.query(
    `SELECT profile FROM user_profiles WHERE user_id = $1`,
    [userId],
  );
  const profileJson = profileRes.rows[0]?.profile ?? null;

  // RAG: relevant profile chunks
  const emb = await getJobEmbedding(jobId);
  let chunks: ChunkRow[] = [];
  if (emb) {
    const lit = `[${emb.join(",")}]`;
    const chunkRes = await pool.query(
      `SELECT content, 1 - (embedding <=> $1::vector) AS similarity
       FROM profile_embedding_chunks
       WHERE user_id = $2
       ORDER BY embedding <=> $1::vector
       LIMIT 5`,
      [lit, userId],
    );
    chunks = chunkRes.rows.map((r) => ({
      content: r.content,
      similarity: Number(r.similarity),
    }));
  }

  return {
    matchId,
    userId,
    jobId,
    jobTitle: job.title,
    jobCompany: job.company,
    jobLocation: job.location,
    jobDescription: job.description,
    jobSeniorityLevel: job.seniority_level ?? null,
    jobFactsJson: job.job_facts_json ?? null,
    formFields: fieldsRes.rows,
    profileJson,
    relevantChunks: chunks,
  };
}

export async function getJdRequirements(jobId: string): Promise<JdRequirements | null> {
  const res = await pool.query(
    `SELECT jd_requirements_json FROM discovered_jobs WHERE id = $1`,
    [jobId],
  );
  if (res.rows.length === 0 || !res.rows[0].jd_requirements_json) return null;
  return res.rows[0].jd_requirements_json as JdRequirements;
}

export async function upsertJdRequirements(jobId: string, jd: JdRequirements): Promise<void> {
  await pool.query(
    `UPDATE discovered_jobs SET jd_requirements_json = $2::jsonb WHERE id = $1`,
    [jobId, JSON.stringify(jd)],
  );
}

export async function getProfileEmbeddingSections(
  userId: string,
  jobId: string,
  limit = 15,
): Promise<Array<{ key: string; content: string; similarity: number }>> {
  const emb = await getJobEmbedding(jobId);
  if (!emb) return [];
  const lit = `[${emb.join(",")}]`;
  const chunkRes = await pool.query(
    `SELECT section_key, content, 1 - (embedding <=> $1::vector) AS similarity
     FROM profile_embedding_chunks
     WHERE user_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [lit, userId, limit],
  );
  return chunkRes.rows.map((r) => ({
    key: r.section_key as string,
    content: r.content as string,
    similarity: Number(r.similarity),
  }));
}

export async function insertTailoredApplication(
  matchId: number,
  userId: string,
  jobId: string,
  resume: string,
  coverLetter: string,
  formAnswers: { label: string; value: string }[],
  resumePdfUrl: string,
  extras?: {
    resumeFilename?: string;
    structuredResume?: StructuredResume;
    metadata?: TailorMetadata;
  },
): Promise<void> {
  await pool.query(
    `INSERT INTO tailored_applications (
       match_id, user_id, job_id, tailored_resume, tailored_cover_letter,
       form_answers, resume_pdf_url, resume_filename, structured_resume_json,
       tailor_metadata_json, status
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, 'completed')`,
    [
      matchId,
      userId,
      jobId,
      resume,
      coverLetter,
      JSON.stringify(formAnswers),
      resumePdfUrl,
      extras?.resumeFilename ?? null,
      extras?.structuredResume ? JSON.stringify(extras.structuredResume) : null,
      extras?.metadata ? JSON.stringify(extras.metadata) : null,
    ],
  );
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
