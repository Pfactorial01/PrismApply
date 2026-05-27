import "dotenv/config";

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return fallback;
}

export const discoveryConfig = {
  enabled: boolEnv("DISCOVERY_ENABLED", true),
  serperApiKey: process.env.SERPER_API_KEY ?? "",
  serperNumResults: intEnv("DISCOVERY_SERPER_NUM_RESULTS", 10),
  searchFreshnessDays: intEnv("DISCOVERY_SEARCH_FRESHNESS_DAYS", 30),
  maxScrapesPerRun: intEnv("DISCOVERY_MAX_SCRAPES_PER_RUN", 50),
  cronSchedule: process.env.DISCOVERY_CRON_SCHEDULE ?? "0 */6 * * *",
  embeddingModel: process.env.EMBEDDING_MODEL ?? "text-embedding-3-small",
  stagehandEnv: (process.env.ENV ?? "LOCAL") as "LOCAL" | "BROWSERBASE",
  browserbaseApiKey: process.env.BROWSERBASE_API_KEY ?? "",
  browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID ?? "",
  stagehandModel: process.env.MODEL ?? "openai/gpt-4o-mini",
  chromePath: process.env.CHROME_PATH ?? "",
};

export function requireSerperKey(): string {
  const key = discoveryConfig.serperApiKey.trim();
  if (!key) {
    throw new Error("SERPER_API_KEY is not set in orchestration/.env");
  }
  return key;
}

/** Append Google `after:YYYY-MM-DD` so Serper results stay within the last N days. */
export function withSearchFreshness(
  query: string,
  days = discoveryConfig.searchFreshnessDays,
): string {
  if (/\bafter:\d{4}-\d{2}-\d{2}\b/i.test(query)) return query;
  const after = new Date();
  after.setDate(after.getDate() - days);
  const dateStr = after.toISOString().slice(0, 10);
  return `${query} after:${dateStr}`;
}
