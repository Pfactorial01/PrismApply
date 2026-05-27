import "dotenv/config";
import { Client, Connection, ScheduleOverlapPolicy } from "@temporalio/client";
import { discoveryConfig } from "./config/discovery.js";

const SCHEDULE_ID = "discover-tech-jobs";

async function main() {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const namespace = process.env.TEMPORAL_NAMESPACE ?? "default";
  const taskQueue = process.env.TASK_QUEUE ?? "prismapply-orchestration";

  const connection = await Connection.connect({ address });
  const client = new Client({ connection, namespace });

  const cron = discoveryConfig.cronSchedule;
  const enabled = discoveryConfig.enabled;
  console.log(
    `Registering schedule "${SCHEDULE_ID}" cron="${cron}" enabled=${enabled} queue=${taskQueue}`,
  );

  const scheduleAction = {
    type: "startWorkflow" as const,
    workflowType: "discoverTechJobs",
    taskQueue,
    args: [{ maxScrapes: discoveryConfig.maxScrapesPerRun }],
  };

  try {
    await client.schedule.create({
      scheduleId: SCHEDULE_ID,
      spec: { cronExpressions: [cron] },
      policies: {
        overlap: ScheduleOverlapPolicy.SKIP,
        pauseOnFailure: false,
      },
      state: { paused: !enabled },
      action: scheduleAction,
    });
    console.log(`Created schedule ${SCHEDULE_ID} (paused=${!enabled})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists") || msg.includes("AlreadyExists")) {
      const handle = client.schedule.getHandle(SCHEDULE_ID);
      await handle.update((prev) => ({
        ...prev,
        spec: { cronExpressions: [cron] },
        action: scheduleAction,
      }));
      if (enabled) {
        await handle.unpause("DISCOVERY_ENABLED=true");
      } else {
        await handle.pause("DISCOVERY_ENABLED=false");
      }
      console.log(`Updated existing schedule ${SCHEDULE_ID} (paused=${!enabled})`);
    } else {
      throw err;
    }
  }

  await connection.close();
}

main().catch((err) => {
  console.error("registerSchedules failed:", err);
  process.exit(1);
});
