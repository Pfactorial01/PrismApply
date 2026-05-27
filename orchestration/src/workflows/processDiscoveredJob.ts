import { proxyActivities } from "@temporalio/workflow";
import type { MatchResult } from "../activities/matchJob.js";
import type { TailorResult } from "../activities/tailorForUser.js";

export interface Activities {
  matchJob(jobId: string): Promise<MatchResult>;
  tailorForUser(matchId: number): Promise<TailorResult>;
}

// Injected by the Temporal Worker at runtime
const { matchJob, tailorForUser } = proxyActivities<Activities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    initialInterval: "10 seconds",
    maximumAttempts: 3,
  },
});

/**
 * Process a newly discovered job:
 * 1. Match it to users (pgvector HNSW)
 * 2. For each matched user, generate a tailored application package (LLM → PDF → R2)
 */
export async function processDiscoveredJob(jobId: string): Promise<{
  matchCount: number;
  tailorResults: TailorResult[];
}> {
  console.log(`Workflow started: jobId=${jobId}`);

  const { matchIds } = await matchJob(jobId);
  console.log(`Workflow: ${matchIds.length} matches`);

  const tailorResults = await Promise.all(
    matchIds.map((mid) => tailorForUser(mid)),
  );
  console.log(`Workflow: ${tailorResults.length} tailored`);

  console.log(`Workflow complete: ${tailorResults.length} packages generated`);
  return { matchCount: matchIds.length, tailorResults };
}
