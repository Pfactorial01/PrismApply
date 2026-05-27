import { proxyActivities, startChild, WorkflowIdReusePolicy } from "@temporalio/workflow";
import type { DiscoverTechJobsResult, SearchGoogleResult } from "../discovery/types.js";
import type { DiscoveredJobPayload, EmbedStoreResult } from "../discovery/types.js";
import type { DedupResult, DiscoveryQuery } from "../discovery/types.js";
import { processDiscoveredJob } from "./processDiscoveredJob.js";

export interface DiscoveryActivities {
  loadDiscoveryQueries(): Promise<DiscoveryQuery[]>;
  searchGoogle(input: { queryId: number; query: string }): Promise<SearchGoogleResult>;
  updateDiscoveryQueryRun(queryId: number, resultCount: number): Promise<void>;
  dedupJobUrls(urls: Array<{ url: string; source: "lever" | "greenhouse" | "ashby" }>): Promise<DedupResult>;
  scrapeAndEnrichJob(input: { url: string; searchQueryId?: number }): Promise<DiscoveredJobPayload>;
  embedAndStoreJob(job: DiscoveredJobPayload): Promise<EmbedStoreResult>;
}

const {
  loadDiscoveryQueries,
  searchGoogle,
  updateDiscoveryQueryRun,
  dedupJobUrls,
  scrapeAndEnrichJob,
  embedAndStoreJob,
} = proxyActivities<DiscoveryActivities>({
  startToCloseTimeout: "10 minutes",
  retry: {
    initialInterval: "10 seconds",
    maximumAttempts: 2,
  },
});

const DEFAULT_MAX_SCRAPES = 50;

export interface DiscoverTechJobsInput {
  maxScrapes?: number;
}

/**
 * Scheduled job discovery: Serper search → dedup → scrape + enrich → embed → match/tailor.
 */
export async function discoverTechJobs(
  input: DiscoverTechJobsInput = {},
): Promise<DiscoverTechJobsResult> {
  const maxScrapes = input.maxScrapes ?? DEFAULT_MAX_SCRAPES;

  const result: DiscoverTechJobsResult = {
    queriesRun: 0,
    urlsFound: 0,
    knownUrls: 0,
    newUrls: 0,
    jobsStored: 0,
    matchWorkflowsStarted: 0,
    errors: 0,
  };

  console.log(`[discoverTechJobs] run started maxScrapes=${maxScrapes}`);

  const queries = await loadDiscoveryQueries();
  const scrapeQueue: Array<{ url: string; source: "lever" | "greenhouse" | "ashby"; searchQueryId: number }> = [];

  for (const q of queries) {
    if (scrapeQueue.length >= maxScrapes) break;

    const search = await searchGoogle({ queryId: q.id, query: q.query });
    await updateDiscoveryQueryRun(q.id, search.urls.length);
    result.queriesRun++;
    result.urlsFound += search.urls.length;

    if (search.error) {
      result.errors++;
      continue;
    }

    const dedup = await dedupJobUrls(search.urls);
    result.knownUrls += dedup.knownCount;

    for (const item of dedup.newUrls) {
      if (scrapeQueue.length >= maxScrapes) break;
      scrapeQueue.push({ ...item, searchQueryId: q.id });
    }
  }

  result.newUrls = scrapeQueue.length;
  console.log(`[discoverTechJobs] scrape queue=${scrapeQueue.length}`);

  for (const item of scrapeQueue) {
    try {
      const job = await scrapeAndEnrichJob({
        url: item.url,
        searchQueryId: item.searchQueryId,
      });
      const stored = await embedAndStoreJob(job);
      result.jobsStored++;

      await startChild(processDiscoveredJob, {
        args: [stored.jobId],
        workflowId: `discover-${stored.jobId}`,
        workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE,
      });
      result.matchWorkflowsStarted++;
    } catch {
      result.errors++;
    }
  }

  console.log(
    `[discoverTechJobs] complete queries=${result.queriesRun} new=${result.newUrls} stored=${result.jobsStored} errors=${result.errors}`,
  );
  return result;
}
