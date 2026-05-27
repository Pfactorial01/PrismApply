/**
 * Batch-test Serper discovery queries — reports ATS job URL hits per query.
 * Usage: npm run test:search-queries
 */
import "dotenv/config";
import { discoveryConfig, requireSerperKey, withSearchFreshness } from "./config/discovery.js";
import { filterAtsJobUrls } from "./discovery/atsUrls.js";

function withFreshness(query: string): string {
  return withSearchFreshness(query);
}

interface SerperOrganicResult {
  link?: string;
  title?: string;
}

async function serperSearch(query: string): Promise<{ links: string[]; error?: string }> {
  const apiKey = requireSerperKey();
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: discoveryConfig.serperNumResults }),
  });
  if (!res.ok) {
    return { links: [], error: `HTTP ${res.status}: ${(await res.text()).slice(0, 120)}` };
  }
  const data = (await res.json()) as { organic?: SerperOrganicResult[] };
  const links = (data.organic ?? [])
    .map((r) => r.link)
    .filter((l): l is string => typeof l === "string");
  return { links };
}

/** Candidate queries to evaluate (no after: — added at search time). */
const CANDIDATES: Array<{ query: string; priority: number; tag: string }> = [
  // --- existing role-based (baseline) ---
  { tag: "role", priority: 10, query: 'site:jobs.lever.co ("software engineer" OR "backend engineer" OR "full stack")' },
  { tag: "role", priority: 10, query: 'site:boards.greenhouse.io ("software engineer" OR "platform engineer")' },
  { tag: "role", priority: 10, query: 'site:jobs.ashbyhq.com ("software engineer" OR "data engineer")' },

  // --- Node / TypeScript / JS ---
  { tag: "node", priority: 15, query: 'site:jobs.lever.co ("node.js" OR "nodejs" OR "node developer")' },
  { tag: "node", priority: 15, query: 'site:boards.greenhouse.io ("node.js" OR "typescript" OR "javascript")' },
  { tag: "node", priority: 15, query: 'site:jobs.ashbyhq.com ("node.js" OR "typescript")' },
  { tag: "node", priority: 20, query: 'site:jobs.lever.co ("nestjs" OR "express.js" OR "fastify")' },
  { tag: "node", priority: 20, query: 'site:boards.greenhouse.io "full stack" ("react" OR "next.js")' },
  { tag: "node", priority: 25, query: 'site:jobs.ashbyhq.com ("next.js" OR "react" OR "typescript")' },

  // --- Python ---
  { tag: "python", priority: 15, query: 'site:jobs.lever.co ("python" OR "django" OR "fastapi")' },
  { tag: "python", priority: 15, query: 'site:boards.greenhouse.io ("python engineer" OR "python developer")' },
  { tag: "python", priority: 20, query: 'site:jobs.ashbyhq.com ("python" OR "flask" OR "django")' },
  { tag: "python", priority: 25, query: 'site:jobs.lever.co "machine learning" ("python" OR "pytorch")' },

  // --- Go / Rust ---
  { tag: "systems", priority: 20, query: 'site:jobs.lever.co ("golang" OR "go engineer" OR "go developer")' },
  { tag: "systems", priority: 20, query: 'site:boards.greenhouse.io ("rust" OR "golang" OR "systems engineer")' },
  { tag: "systems", priority: 25, query: 'site:jobs.ashbyhq.com ("rust" OR "golang")' },

  // --- Java / Kotlin / JVM ---
  { tag: "jvm", priority: 20, query: 'site:jobs.lever.co ("java" OR "kotlin" OR "spring boot")' },
  { tag: "jvm", priority: 20, query: 'site:boards.greenhouse.io ("java engineer" OR "kotlin" OR "spring")' },
  { tag: "jvm", priority: 25, query: 'site:jobs.ashbyhq.com ("java" OR "kotlin")' },

  // --- Ruby / PHP ---
  { tag: "web", priority: 30, query: 'site:jobs.lever.co ("ruby" OR "rails" OR "ruby on rails")' },
  { tag: "web", priority: 30, query: 'site:boards.greenhouse.io ("php" OR "laravel" OR "symfony")' },

  // --- Frontend ---
  { tag: "frontend", priority: 20, query: 'site:jobs.lever.co ("react" OR "frontend engineer" OR "frontend developer")' },
  { tag: "frontend", priority: 20, query: 'site:boards.greenhouse.io ("react" OR "vue" OR "angular")' },
  { tag: "frontend", priority: 25, query: 'site:jobs.ashbyhq.com ("frontend" OR "react" OR "vue")' },

  // --- Mobile ---
  { tag: "mobile", priority: 25, query: 'site:jobs.lever.co ("iOS" OR "Swift" OR "Android" OR "Kotlin")' },
  { tag: "mobile", priority: 25, query: 'site:boards.greenhouse.io ("mobile engineer" OR "react native" OR "flutter")' },

  // --- Data / ML ---
  { tag: "data", priority: 20, query: 'site:jobs.lever.co ("data engineer" OR "spark" OR "airflow")' },
  { tag: "data", priority: 20, query: 'site:boards.greenhouse.io ("data engineer" OR "dbt" OR "snowflake")' },
  { tag: "data", priority: 25, query: 'site:jobs.ashbyhq.com ("machine learning" OR "ML engineer" OR "LLM")' },

  // --- DevOps / Cloud / Infra ---
  { tag: "infra", priority: 20, query: 'site:jobs.lever.co ("kubernetes" OR "k8s" OR "terraform")' },
  { tag: "infra", priority: 20, query: 'site:boards.greenhouse.io ("devops" OR "SRE" OR "platform engineer")' },
  { tag: "infra", priority: 25, query: 'site:jobs.ashbyhq.com ("aws" OR "cloud engineer" OR "infrastructure")' },
  { tag: "infra", priority: 30, query: 'site:jobs.lever.co ("docker" OR "CI/CD" OR "GitOps")' },

  // --- Databases ---
  { tag: "db", priority: 35, query: 'site:boards.greenhouse.io ("postgres" OR "postgresql" OR "mongodb")' },
  { tag: "db", priority: 35, query: 'site:jobs.lever.co ("redis" OR "kafka" OR "postgresql")' },

  // --- Security / QA ---
  { tag: "other", priority: 30, query: 'site:boards.greenhouse.io ("security engineer" OR "application security")' },
  { tag: "other", priority: 30, query: 'site:jobs.ashbyhq.com ("QA engineer" OR "SDET" OR "test automation")' },

  // --- Senior / leadership ---
  { tag: "senior", priority: 40, query: 'site:jobs.lever.co ("staff engineer" OR "principal engineer" OR "senior software")' },
  { tag: "senior", priority: 40, query: 'site:boards.greenhouse.io ("engineering manager" OR "tech lead")' },

  // --- Remote modifiers ---
  { tag: "remote", priority: 50, query: 'site:jobs.lever.co remote ("software engineer" OR "backend")' },
  { tag: "remote", priority: 50, query: 'site:job-boards.greenhouse.io remote ("software engineer" OR "full stack")' },
  { tag: "remote", priority: 55, query: 'site:jobs.ashbyhq.com remote ("typescript" OR "python" OR "go")' },
];

const MIN_ATS = 3;
const DELAY_MS = 400;

async function main() {
  const sample = withSearchFreshness("test");
  const after = sample.match(/after:(\d{4}-\d{2}-\d{2})/)?.[1] ?? "?";
  console.log(`Testing ${CANDIDATES.length} queries with after:${after}\n`);

  const results: Array<{
    query: string;
    priority: number;
    tag: string;
    raw: number;
    ats: number;
    sample?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < CANDIDATES.length; i++) {
    const c = CANDIDATES[i]!;
    const fullQuery = withFreshness(c.query);
    process.stdout.write(`[${i + 1}/${CANDIDATES.length}] ${c.tag} ... `);

    const { links, error } = await serperSearch(fullQuery);
    const ats = filterAtsJobUrls(links);

    results.push({
      query: c.query,
      priority: c.priority,
      tag: c.tag,
      raw: links.length,
      ats: ats.length,
      sample: ats[0]?.url,
      error,
    });

    console.log(error ? `ERR ${error}` : `raw=${links.length} ats=${ats.length}`);

    if (i < CANDIDATES.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  const passed = results.filter((r) => !r.error && r.ats >= MIN_ATS);
  const weak = results.filter((r) => !r.error && r.ats > 0 && r.ats < MIN_ATS);
  const zero = results.filter((r) => !r.error && r.ats === 0);
  const failed = results.filter((r) => r.error);

  console.log(`\n=== Summary (min ATS=${MIN_ATS}) ===`);
  console.log(`Pass: ${passed.length} | Weak: ${weak.length} | Zero: ${zero.length} | Errors: ${failed.length}`);

  console.log("\n--- PASSED ---");
  for (const r of passed.sort((a, b) => b.ats - a.ats || a.priority - b.priority)) {
    console.log(`  [${r.tag}] ats=${r.ats} p=${r.priority} | ${r.query}`);
  }

  if (weak.length) {
    console.log("\n--- WEAK (1-2 ATS) ---");
    for (const r of weak) {
      console.log(`  [${r.tag}] ats=${r.ats} | ${r.query}`);
    }
  }

  if (zero.length) {
    console.log("\n--- ZERO ATS ---");
    for (const r of zero) {
      console.log(`  [${r.tag}] | ${r.query}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
