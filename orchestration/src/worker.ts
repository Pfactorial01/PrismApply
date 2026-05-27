import "dotenv/config";
import { Worker, NativeConnection } from "@temporalio/worker";
import * as activities from "./activities/index.js";

async function connectWithRetry(address: string, attempts = 30, delayMs = 2000) {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await NativeConnection.connect({ address });
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

async function main() {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
  const taskQueue = process.env.TASK_QUEUE ?? "prismapply-orchestration";

  const connection = await connectWithRetry(address);

  const worker = await Worker.create({
    connection,
    namespace,
    taskQueue,
    workflowsPath: new URL("./workflows", import.meta.url).pathname,
    activities,
  });

  console.log(`Worker listening on ${taskQueue} @ ${address}`);
  await worker.run();
  await connection.close();
}

main().catch((err) => {
  console.error("Worker failed:", err);
  process.exit(1);
});
