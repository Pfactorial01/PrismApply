import "dotenv/config";
import { Client, Connection } from "@temporalio/client";
import { discoveryConfig } from "./config/discovery.js";

async function main() {
  if (!discoveryConfig.enabled) {
    console.log("Job discovery is disabled (DISCOVERY_ENABLED=false). Skipping.");
    return;
  }

  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
  const taskQueue = process.env.TASK_QUEUE ?? "prismapply-orchestration";

  const connection = await Connection.connect({ address });
  const client = new Client({ connection, namespace });

  const handle = await client.workflow.start("discoverTechJobs", {
    taskQueue,
    workflowId: `discover-tech-jobs-manual-${Date.now()}`,
    args: [{ maxScrapes: discoveryConfig.maxScrapesPerRun }],
  });

  console.log(`Started discoverTechJobs workflow: ${handle.workflowId}`);
  const result = await handle.result();
  console.log("Result:", result);

  await connection.close();
}

main().catch((err) => {
  console.error("runDiscoveryOnce failed:", err);
  process.exit(1);
});
