import "dotenv/config";
import { searchGoogle } from "./activities/discovery/searchGoogle.js";
import { scrapeAndEnrichJob } from "./activities/discovery/scrapeAndEnrichJob.js";
import { embedAndStoreJob } from "./activities/discovery/embedAndStoreJob.js";
import { discoveryConfig } from "./config/discovery.js";

const MISTRAL_URL =
  "https://jobs.lever.co/mistral/77b8339f-da37-4f38-b554-1d154f72ca8f";

async function main() {
  console.log("=== Job discovery test ===");
  console.log(`Stagehand env: ${discoveryConfig.stagehandEnv}`);
  console.log(`Serper configured: ${Boolean(discoveryConfig.serperApiKey)}`);

  console.log("\n--- 1. Serper Google search ---");
  const search = await searchGoogle({
    queryId: 0,
    query: 'site:jobs.lever.co mistral "Software Engineer, Backend" London',
  });
  console.log(`Raw links: ${search.rawCount}, ATS matches: ${search.urls.length}`);
  if (search.error) console.log(`Search error: ${search.error}`);
  for (const u of search.urls.slice(0, 5)) {
    console.log(`  ${u.url}`);
  }

  const scrapeUrl =
    search.urls.find((u) => u.url.includes("mistral/77b8339f"))?.url ?? MISTRAL_URL;

  console.log(`\n--- 2. Scrape + enrich (LOCAL Stagehand): ${scrapeUrl} ---`);
  const job = await scrapeAndEnrichJob({ url: scrapeUrl });

  console.log("\n--- Scrape result ---");
  console.log(`Title:       ${job.title}`);
  console.log(`Company:     ${job.company}`);
  console.log(`Location:    ${job.location}`);
  console.log(`Job URL:     ${job.jobUrl}`);
  console.log(`Apply URL:   ${job.applyUrl}`);
  console.log(`Description: ${job.description?.length ?? 0} chars`);
  console.log(`Form fields: ${job.formFields.length}`);
  console.log("\nForm fields (position = DB order):");
  job.formFields.forEach((f, i) => {
    const opts = f.options?.length ? ` [${f.options.join(", ")}]` : "";
    console.log(
      `  ${i + 1}. [${f.type}${f.required ? ", required" : ""}] ${f.label}${opts}`,
    );
  });

  if (!job.description || job.description.length < 200) {
    throw new Error("Description too short — listing page may not have been scraped correctly");
  }
  if (!job.applyUrl.includes("/apply")) {
    throw new Error("Apply URL missing /apply path");
  }
  if (job.formFields.length < 5) {
    throw new Error(`Expected more form fields, got ${job.formFields.length}`);
  }

  const requiredFields = job.formFields.filter((f) => f.required);
  console.log(`\nRequired fields: ${requiredFields.length}/${job.formFields.length}`);
  for (const f of requiredFields) {
    console.log(`  ✱ ${f.label}`);
  }
  if (requiredFields.length < 4) {
    throw new Error(`Expected at least 4 required fields (Resume, name, email, LinkedIn, etc.), got ${requiredFields.length}`);
  }

  console.log("\n--- 3. Embed + store ---");
  const stored = await embedAndStoreJob(job);
  console.log(`Stored jobId=${stored.jobId} isNew=${stored.isNew}`);

  console.log("\n=== Test passed ===");
}

main().catch((err) => {
  console.error("\n=== Test failed ===");
  console.error(err);
  process.exit(1);
});
