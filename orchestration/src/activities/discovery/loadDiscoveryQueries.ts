import "dotenv/config";
import {
  dedupJobUrls as dedupInDb,
  loadActiveDiscoveryQueries,
  recordDiscoveryQueryRun,
} from "../../discovery/db.js";
import type { DedupResult, DiscoveryQuery } from "../../discovery/types.js";
import type { JobSource } from "../../discovery/types.js";

export async function loadDiscoveryQueries(): Promise<DiscoveryQuery[]> {
  return loadActiveDiscoveryQueries();
}

export async function dedupJobUrls(
  urls: Array<{ url: string; source: JobSource }>,
): Promise<DedupResult> {
  const result = await dedupInDb(urls);
  console.log(`[dedupJobUrls] new=${result.newUrls.length} known=${result.knownCount}`);
  return result;
}

export async function updateDiscoveryQueryRun(
  queryId: number,
  resultCount: number,
): Promise<void> {
  await recordDiscoveryQueryRun(queryId, resultCount);
}
