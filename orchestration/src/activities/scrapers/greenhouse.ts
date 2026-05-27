import type { Stagehand } from "@browserbasehq/stagehand";
import { toListingUrl } from "../../discovery/atsUrls.js";
import type { DiscoveredJobPayload } from "../../discovery/types.js";
import { extractFormFields, jobDetailsSchema } from "./formFields.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function scrapeGreenhouseJob(
  stagehand: Stagehand,
  jobUrl: string,
  searchQueryId?: number,
): Promise<DiscoveredJobPayload> {
  const page = stagehand.context.pages()[0];
  const listingUrl = toListingUrl(jobUrl, "greenhouse");

  await page.goto(listingUrl, { timeoutMs: 45000 });
  await page.waitForLoadState("domcontentloaded");
  await sleep(1500);

  const details = await stagehand.extract(
    "extract the job title, company name, location, and the full job description from this Greenhouse job listing page",
    jobDetailsSchema,
  );

  await stagehand.act(
    "click the 'Apply' or 'Apply for this job' or 'Submit application' button or link to open the application form",
  );
  await page.waitForLoadState("domcontentloaded");
  await sleep(1500);

  const formFields = await extractFormFields(stagehand);

  return {
    source: "greenhouse",
    jobUrl: listingUrl,
    applyUrl: page.url(),
    title: details?.title ?? "Unknown Title",
    company: details?.company ?? "Unknown Company",
    location: details?.location ?? null,
    description: details?.description ?? null,
    formFields,
    searchQueryId,
  };
}
