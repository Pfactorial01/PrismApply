import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { discoveryConfig } from "../../config/discovery.js";
import { detectPlatform } from "../../discovery/atsUrls.js";
import type { DiscoveredJobPayload } from "../../discovery/types.js";
import { scrapeAshbyJob } from "../scrapers/ashby.js";
import { scrapeGreenhouseJob } from "../scrapers/greenhouse.js";
import { scrapeLeverJob } from "../scrapers/lever.js";

export interface ScrapeAndEnrichInput {
  url: string;
  searchQueryId?: number;
}

function createStagehand(): Stagehand {
  const opts: ConstructorParameters<typeof Stagehand>[0] = {
    env: discoveryConfig.stagehandEnv,
    model: discoveryConfig.stagehandModel,
    verbose: 1,
  };

  if (discoveryConfig.stagehandEnv === "BROWSERBASE") {
    opts.apiKey = discoveryConfig.browserbaseApiKey;
  }

  if (discoveryConfig.stagehandEnv === "LOCAL" && discoveryConfig.chromePath) {
    opts.localBrowserLaunchOptions = {
      executablePath: discoveryConfig.chromePath,
    };
  }

  return new Stagehand(opts);
}

export async function scrapeAndEnrichJob(
  input: ScrapeAndEnrichInput,
): Promise<DiscoveredJobPayload> {
  const { url, searchQueryId } = input;
  const platform = detectPlatform(url);
  if (!platform) {
    throw new Error(`unsupported job URL: ${url}`);
  }

  console.log(`[scrapeAndEnrichJob] url=${url} platform=${platform}`);

  const stagehand = createStagehand();
  try {
    await stagehand.init();

    let job: DiscoveredJobPayload;
    switch (platform) {
      case "lever":
        job = await scrapeLeverJob(stagehand, url, searchQueryId);
        break;
      case "greenhouse":
        job = await scrapeGreenhouseJob(stagehand, url, searchQueryId);
        break;
      case "ashby":
        job = await scrapeAshbyJob(stagehand, url, searchQueryId);
        break;
    }

    console.log(
      `[scrapeAndEnrichJob] ${job.title} @ ${job.company} fields=${job.formFields.length}`,
    );
    return job;
  } finally {
    await stagehand.close();
  }
}
