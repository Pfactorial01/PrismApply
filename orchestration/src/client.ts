import "dotenv/config";
import { Client, Connection } from "@temporalio/client";

const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
const taskQueue = process.env.TASK_QUEUE ?? "prismapply-orchestration";

let _client: Client | null = null;

async function getClient(): Promise<Client> {
  if (!_client) {
    const connection = await Connection.connect({ address });
    _client = new Client({ connection, namespace });
  }
  return _client;
}

/**
 * Start a workflow to process a newly discovered job.
 * Used for manual/ad-hoc triggers; discoverTechJobs starts this via child workflow.
 */
export async function startJobWorkflow(jobId: string): Promise<string> {
  const client = await getClient();
  const handle = await client.workflow.start("processDiscoveredJob", {
    args: [jobId],
    taskQueue,
    workflowId: `discover-${jobId}`,
  });
  console.log(`Started workflow: ${handle.workflowId}`);
  return handle.workflowId;
}
