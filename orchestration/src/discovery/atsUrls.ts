import type { JobSource } from "./types.js";

const LEVER_LISTING =
  /^https:\/\/jobs\.lever\.co\/[^/]+\/[a-f0-9-]+$/i;
const GREENHOUSE_LISTING =
  /^https:\/\/(?:boards|job-boards)\.greenhouse\.io\/[^/]+\/jobs\/\d+/i;
const ASHBY_LISTING =
  /^https:\/\/jobs\.ashbyhq\.com\/[^/]+\/[a-f0-9-]+$/i;

export function normalizeJobUrl(url: string): string {
  return url.split("?")[0]?.split("#")[0]?.replace(/\/+$/, "") ?? url;
}

function stripApplySuffix(url: string): string {
  return url.replace(/\/apply$/i, "");
}

/** Normalize to listing URL (Lever /apply stripped). */
export function toListingUrl(url: string, source?: JobSource): string {
  const clean = normalizeJobUrl(url);
  if (source === "lever") {
    return stripApplySuffix(clean);
  }
  if (!source && LEVER_LISTING.test(stripApplySuffix(clean))) {
    return stripApplySuffix(clean);
  }
  return clean;
}

export function leverApplyUrl(listingUrl: string): string {
  return `${stripApplySuffix(normalizeJobUrl(listingUrl))}/apply`;
}

export function detectPlatform(url: string): JobSource | null {
  const clean = stripApplySuffix(normalizeJobUrl(url));
  if (LEVER_LISTING.test(clean)) return "lever";
  if (GREENHOUSE_LISTING.test(clean)) return "greenhouse";
  if (ASHBY_LISTING.test(clean)) return "ashby";
  return null;
}

export function filterAtsJobUrls(links: string[]): Array<{ url: string; source: JobSource }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; source: JobSource }> = [];

  for (const link of links) {
    const source = detectPlatform(link);
    if (!source) continue;
    const listing = toListingUrl(link, source);
    if (seen.has(listing)) continue;
    seen.add(listing);
    out.push({ url: listing, source });
  }

  return out;
}
