import { pool } from "../db.js";
import type { JobFacts } from "../matching/index.js";
import type {
  DedupResult,
  DiscoveredJobPayload,
  DiscoveryQuery,
  FormFieldPayload,
  JobSource,
} from "./types.js";

export async function loadActiveDiscoveryQueries(): Promise<DiscoveryQuery[]> {
  const res = await pool.query(
    `SELECT id, query, priority
     FROM discovery_search_queries
     WHERE active = true
     ORDER BY priority ASC, id ASC`,
  );
  return res.rows.map((r) => ({
    id: Number(r.id),
    query: r.query as string,
    priority: Number(r.priority),
  }));
}

export async function recordDiscoveryQueryRun(
  queryId: number,
  resultCount: number,
): Promise<void> {
  await pool.query(
    `UPDATE discovery_search_queries
     SET last_run_at = now(), last_result_count = $2
     WHERE id = $1`,
    [queryId, resultCount],
  );
}

export async function dedupJobUrls(
  items: Array<{ url: string; source: JobSource }>,
): Promise<DedupResult> {
  if (items.length === 0) {
    return { newUrls: [], knownCount: 0 };
  }

  const newUrls: Array<{ url: string; source: JobSource }> = [];
  let knownCount = 0;

  for (const item of items) {
    const res = await pool.query(
      `SELECT id FROM discovered_jobs WHERE source = $1 AND job_url = $2`,
      [item.source, item.url],
    );
    if (res.rows.length > 0) {
      await pool.query(
        `UPDATE discovered_jobs SET last_seen_at = now() WHERE source = $1 AND job_url = $2`,
        [item.source, item.url],
      );
      knownCount++;
    } else {
      newUrls.push(item);
    }
  }

  return { newUrls, knownCount };
}

export async function insertDiscoveredJobWithFields(
  job: DiscoveredJobPayload,
  embedding: number[] | null,
  facts?: JobFacts,
): Promise<string> {
  const rawData = { formFields: job.formFields, jobFacts: facts ?? null };
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const res = await client.query(
      `INSERT INTO discovered_jobs (
         source, job_url, apply_url, title, company, location, description,
         raw_data, embedding, search_query_id, last_seen_at,
         remote_policy, employment_type, seniority_level, requires_sponsorship,
         industry_tags, has_heavy_oncall, job_facts_json
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(),
               $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
      [
        job.source,
        job.jobUrl,
        job.applyUrl,
        job.title,
        job.company,
        job.location,
        job.description,
        JSON.stringify(rawData),
        embedding ? `[${embedding.join(",")}]` : null,
        job.searchQueryId ?? null,
        facts?.remotePolicy ?? null,
        facts?.employmentType ?? null,
        facts?.seniorityLevel ?? null,
        facts?.requiresSponsorship ?? null,
        facts?.industryTags ?? [],
        facts?.hasHeavyOncall ?? null,
        facts ? JSON.stringify(facts) : null,
      ],
    );

    const jobId = res.rows[0].id as string;

    for (let i = 0; i < job.formFields.length; i++) {
      const f: FormFieldPayload = job.formFields[i]!;
      await client.query(
        `INSERT INTO job_form_fields (job_id, label, field_type, required, options, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          jobId,
          f.label,
          f.type,
          f.required,
          f.options ? JSON.stringify(f.options) : null,
          i,
        ],
      );
    }

    await client.query("COMMIT");
    return jobId;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function replaceJobEmbeddingSections(
  jobId: string,
  sections: Array<{ sectionKey: string; content: string; embedding: number[] }>,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM job_embedding_sections WHERE job_id = $1`, [jobId]);
    for (const s of sections) {
      await client.query(
        `INSERT INTO job_embedding_sections (job_id, section_key, content, embedding)
         VALUES ($1, $2, $3, $4::vector)`,
        [jobId, s.sectionKey, s.content, `[${s.embedding.join(",")}]`],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
