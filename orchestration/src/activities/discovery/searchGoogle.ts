import "dotenv/config";
import { discoveryConfig, requireSerperKey, withSearchFreshness } from "../../config/discovery.js";
import { filterAtsJobUrls } from "../../discovery/atsUrls.js";
import type { SearchGoogleResult } from "../../discovery/types.js";

interface SerperOrganicResult {
  link?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
}

export interface SearchGoogleInput {
  queryId: number;
  query: string;
}

export async function searchGoogle(input: SearchGoogleInput): Promise<SearchGoogleResult> {
  const { queryId, query } = input;
  const q = withSearchFreshness(query);
  console.log(`[searchGoogle] query_id=${queryId} q=${q.slice(0, 100)}...`);

  try {
    const apiKey = requireSerperKey();
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q,
        num: discoveryConfig.serperNumResults,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      const msg = `Serper HTTP ${res.status}: ${body.slice(0, 200)}`;
      console.error(`[searchGoogle] ${msg}`);
      return { urls: [], rawCount: 0, error: msg };
    }

    const data = (await res.json()) as SerperResponse;
    const links = (data.organic ?? [])
      .map((r) => r.link)
      .filter((l): l is string => typeof l === "string" && l.length > 0);

    const urls = filterAtsJobUrls(links);
    console.log(`[searchGoogle] query_id=${queryId} raw=${links.length} ats=${urls.length}`);
    return { urls, rawCount: links.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[searchGoogle] query_id=${queryId} error=${msg}`);
    return { urls: [], rawCount: 0, error: msg };
  }
}
