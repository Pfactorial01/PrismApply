import "dotenv/config";
import { Client, Connection, WorkflowIdReusePolicy } from "@temporalio/client";
import { createRedisClient } from "./redis.js";

const REDIS_ADDR = process.env.REDIS_ADDR ?? "127.0.0.1:6379";
const MATCH_QUEUE_KEY = "prismapply:match:new";

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE ?? "default";
const TASK_QUEUE = process.env.TASK_QUEUE ?? "prismapply-orchestration";

let temporalClient: Client | null = null;

async function connectTemporal(): Promise<Connection> {
  const attempts = 30;
  const delayMs = 2000;
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await Connection.connect({ address: TEMPORAL_ADDRESS });
    } catch (err) {
      lastErr = err;
      if (i < attempts) {
        console.warn(`Temporal connect attempt ${i}/${attempts} failed, retrying...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

async function getTemporalClient(): Promise<Client> {
  if (!temporalClient) {
    const connection = await connectTemporal();
    temporalClient = new Client({ connection, namespace: TEMPORAL_NAMESPACE });
  }
  return temporalClient;
}

async function main() {
  const redis = await createRedisClient();
  console.log(`Match consumer connected to Redis at ${REDIS_ADDR}`);

  console.log(`Polling Redis queue "${MATCH_QUEUE_KEY}" for new matches...`);

  while (true) {
    try {
      const raw = await redis.blPop(MATCH_QUEUE_KEY, 0);
      if (!raw) continue;

      const { match_id } = JSON.parse(raw.element) as { match_id: number };
      console.log(`Match consumer: starting workflow for matchId=${match_id}`);

      const client = await getTemporalClient();
      await client.workflow.start("processUserMatch", {
        args: [match_id],
        taskQueue: TASK_QUEUE,
        workflowId: `user-match-${match_id}`,
        workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_ALLOW_DUPLICATE,
      });

      console.log(`  Started workflow user-match-${match_id}`);
    } catch (err) {
      console.error("Match consumer error:", err);
    }
  }
}

main().catch((err) => {
  console.error("Match consumer failed:", err);
  process.exit(1);
});
