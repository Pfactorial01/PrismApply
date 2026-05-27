import { proxyActivities } from "@temporalio/workflow";
import type { TailorResult } from "../activities/tailorForUser.js";

export interface Activities {
  tailorForUser(matchId: number): Promise<TailorResult>;
}

const { tailorForUser } = proxyActivities<Activities>({
  startToCloseTimeout: "10 minutes",
  retry: {
    initialInterval: "10 seconds",
    maximumAttempts: 3,
  },
});

export async function processUserMatch(matchId: number): Promise<{
  tailorResult: TailorResult;
}> {
  console.log(`[processUserMatch] matchId=${matchId}`);
  const tailorResult = await tailorForUser(matchId);
  console.log(`[processUserMatch] complete matchId=${matchId}`);
  return { tailorResult };
}
