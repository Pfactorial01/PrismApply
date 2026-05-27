import type { Stagehand } from "@browserbasehq/stagehand";
import { leverApplyUrl, toListingUrl } from "../../discovery/atsUrls.js";
import type { DiscoveredJobPayload } from "../../discovery/types.js";
import { extractFormFields, jobDetailsSchema } from "./formFields.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function scrapeLeverJob(
  stagehand: Stagehand,
  jobUrl: string,
  searchQueryId?: number,
): Promise<DiscoveredJobPayload> {
  const page = stagehand.context.pages()[0];
  const listingUrl = toListingUrl(jobUrl, "lever");
  const expectedApplyUrl = leverApplyUrl(listingUrl);

  // Step 1: job listing page (description lives here, not on /apply)
  await page.goto(listingUrl, { timeoutMs: 45000 });
  await page.waitForLoadState("domcontentloaded");
  await sleep(1500);

  const details = await stagehand.extract(
    "extract the job title, company name, location, and the full job description from this Lever job listing page. Include all sections such as role summary, responsibilities, requirements, and benefits",
    jobDetailsSchema,
  );

  // Step 2: open the application form via Apply button
  await stagehand.act(
    "click the 'Apply for this job' button or link to open the job application form",
  );
  await page.waitForLoadState("domcontentloaded");
  await sleep(1500);

  const applyUrl = page.url().includes("/apply") ? page.url() : expectedApplyUrl;

  // Step 3: form fields on /apply page
  const formFields = await extractFormFields(stagehand);

  return {
    source: "lever",
    jobUrl: listingUrl,
    applyUrl,
    title: details?.title ?? "Unknown Title",
    company: details?.company ?? "Unknown Company",
    location: details?.location ?? null,
    description: details?.description ?? null,
    formFields,
    searchQueryId,
  };
}
