# PrismApply — Architecture & Plan

## Stack
- **API** — Go (pgx, JWT, embed worker, migrations)
- **Job Discovery** — folded into **Orchestration** (Serper/SerpApi Google Search API + Stagehand scrape + OpenAI embeddings)
- **Tailoring** — Node.js/TS, OpenAI gpt-4o-mini, puppeteer-core (PDF), R2
- **Orchestration** — Node.js/TS, Temporal (discovery + match + tailor workflows)
- **Frontend** — React SPA (Vite) dashboard to view tailored application packages
- **Database** — Postgres + pgvector (local, pw: `root`)
- **Queue** — Temporal (replaced Redis fan-out)
- **Object Storage** — Cloudflare R2 (PDFs)

## Services

### orchestration/ (Node + Temporal)

Worker listens on `prismapply-orchestration` queue. Job discovery lives in this service (Serper + Stagehand scrapers + `discoverTechJobs` cron workflow).

#### Workflow: `discoverTechJobs` (Temporal Cron — scheduled)

Runs on a schedule (e.g. every 6 hours). For each curated search keyword:

```
searchGoogle(keyword) → [jobUrls]
    ↓ dedup against discovered_jobs
for each new URL:
  scrapeAndEnrichJob(url)   ← Stagehand: listing + apply form fields at scrape time
  embedAndStoreJob(job)     ← OpenAI embed + upsert discovered_jobs + job_form_fields
  processDiscoveredJob(jobId)  ← child workflow or inline match + tailor
```

**Design decisions (locked in):**
- **Discovery method:** Google Search via a reliable SERP API (not Stagehand-on-Google)
- **Keywords:** Curated tech-focused search query list (geography + role scope encoded in queries)
- **Scheduling:** Temporal cron workflow
- **Enrichment:** Full scrape + form field extraction **at ingest time** (not deferred to match)
- **Scope (pilot):** All kinds of tech jobs; geography is controlled by keyword list, not a separate filter

#### Google Search API choice

| Option | Verdict |
|--------|---------|
| **Serper.dev** (recommended) | Google-only, fast (~1s p50), cheap (~$1/1K queries, 2.5K free trial). Clean JSON with `organic` results. Best fit for our Google-only ATS dorking. |
| **SerpApi** (alternative) | More expensive (~$5–15/1K) but deeper SERP parsing, 80+ engines, very mature. Use if Serper reliability is insufficient. |
| **Google Custom Search JSON API** | **Do not use** — stopped accepting new customers in 2025, sunsets Jan 2027, max 10 results/query. |

See **Job Discovery Service** section below for env vars, file layout, and implementation checklist.

#### Curated search keywords

Stored in DB table `discovery_search_queries` (or seed JSON checked into repo for v1):

| Column | Purpose |
|--------|---------|
| `id` | PK |
| `query` | Full Google query string |
| `active` | Toggle |
| `priority` | Poll order / frequency weight |
| `last_run_at` | Scheduling metadata |
| `platforms` | Optional tag: lever, greenhouse, ashby |

**Query pattern examples** (tech pilot — geography baked into queries):

```
site:jobs.lever.co ("software engineer" OR "backend engineer" OR "full stack")
site:boards.greenhouse.io ("software engineer" OR "platform engineer")
site:jobs.ashbyhq.com ("software engineer" OR "data engineer")
site:jobs.lever.co "machine learning engineer" remote
site:boards.greenhouse.io "devops" OR "SRE"
site:jobs.lever.co "frontend" OR "mobile" OR "iOS" OR "Android"
site:boards.greenhouse.io "security engineer" OR "infosec"
site:jobs.ashbyhq.com "QA" OR "SDET" OR "test engineer"
```

Cover all tech verticals (SWE, data, ML, DevOps/SRE, security, mobile, QA, TPM, etc.) and geographies (remote, US, EU, etc.) by expanding the keyword list — not by post-filtering results.

**URL filtering:** After Serper returns organic links, filter to known ATS URL patterns (Lever, Greenhouse, Ashby) before scrape.

#### Workflow: `processDiscoveredJob` (existing)

```
matchJob(jobId) → [matchIds]
    ↓ fan-out (Promise.all)
tailorForUser(matchId) × N
```

#### Activities

**Discovery activities:**

| Activity | Responsibility |
|----------|----------------|
| `searchGoogle` | Call Serper with curated query; return filtered ATS job URLs |
| `scrapeAndEnrichJob` | Stagehand: job details + click Apply + extract form fields (Lever/Greenhouse/Ashby scrapers) |
| `embedAndStoreJob` | Embed description via OpenAI; upsert `discovered_jobs` + `job_form_fields`; return jobId |

**Matching + tailoring (existing):**

**matchJob** — `src/activities/matchJob.ts`
- Reads job embedding from `discovered_jobs`
- Queries `profile_embedding_chunks` via pgvector HNSW cosine similarity (threshold 0.65)
- Inserts rows into `job_matches`
- Returns match IDs for fan-out

**tailorForUser** — `src/activities/tailorForUser.ts`
- Loads match + job + form fields + profile + relevant chunks (RAG)
- Calls gpt-4o-mini with structured JSON output (resume, cover letter, form answers)
- Renders resume PDF via puppeteer-core
- Uploads PDF to R2
- Stores in `tailored_applications` with status `completed`

### tailoring/ (deleted — merged into orchestration)

**Local dev:** `./start.sh` expects Temporal on `:7233` (native install). If not running, it tries `~/.temporalio/bin/temporal server start-dev --headless`, registers the discovery cron, then starts API, workers, and frontend.

## Database Schema

### `discovery_search_queries` (new)
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | PK |
| query | TEXT | Full Google search string |
| active | BOOLEAN | Default true |
| priority | INT | Lower = run first |
| last_run_at | TIMESTAMPTZ | |
| last_result_count | INT | Health / observability |

### `discovered_jobs`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| source | TEXT | lever, greenhouse, ashby |
| job_url | TEXT | Original listing URL |
| apply_url | TEXT | Form URL (after clicking "apply") |
| title, company, location, description | TEXT | |
| embedding | vector(1536) | For pgvector matching |
| discovered_at | TIMESTAMPTZ | First seen |
| last_seen_at | TIMESTAMPTZ | Updated on re-discovery (new) |
| search_query_id | BIGINT | FK → discovery_search_queries, nullable (new) |

### `job_form_fields`
| Column | Type | Notes |
|---|---|---|
| job_id | UUID | FK → discovered_jobs |
| label | TEXT | Field label |
| field_type | TEXT | text, email, tel, file, select, textarea, checkbox, radio |
| required | BOOLEAN | |
| options | JSONB | For select/radio |
| position | INT | |

### `job_matches`
| Column | Type | Notes |
|---|---|---|
| id | BIGSERIAL | PK |
| user_id | UUID | FK → users |
| job_id | UUID | FK → discovered_jobs |
| score | REAL | Avg cosine similarity |
| matched_chunks | INT | Count above threshold |
| status | TEXT | pending → ... |
| UNIQUE(user_id, job_id) | | |

### `tailored_applications`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| job_id | UUID | FK → discovered_jobs |
| match_id | BIGINT | FK → job_matches |
| tailored_resume | TEXT | LLM-generated plain-text resume |
| tailored_cover_letter | TEXT | LLM-generated cover letter |
| form_answers | JSONB | [{label, value}] |
| resume_pdf_url | TEXT | R2 URL or local path |
| status | TEXT | queued → completed |
| created_at | TIMESTAMPTZ | When the package was generated |

### Other tables
`users`, `user_profiles` (JSON profile), `profile_embedding_chunks` (pgvector chunks)

## Migrations applied: 000001 through 000011

---

## Job Discovery Service (orchestration/)

Job discovery lives inside **orchestration/** as Temporal workflows and activities.

### Purpose

Periodically search Google for new tech job listings on ATS platforms (Lever, Greenhouse, Ashby), scrape each listing with full form enrichment at ingest time, embed the description, store in Postgres, and trigger the existing match → tailor pipeline.

### Design decisions (locked in)

| Decision | Choice |
|----------|--------|
| Discovery | Google Search via **Serper.dev** API |
| Keywords | Curated tech-focused query list in `discovery_search_queries` |
| Geography | Encoded in search queries (remote, US, EU, etc.) — no separate geo filter |
| Scope (pilot) | All kinds of tech jobs (SWE, data, ML, DevOps, security, mobile, QA, etc.) |
| Scheduling | Temporal cron workflow |
| Enrichment | Full scrape + form fields **at ingest time** |
| Service home | `orchestration/` (not a separate service) |

### Environment variables

Set in `orchestration/.env` (see `orchestration/.env.example`):

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `SERPER_API_KEY` | Yes (discovery) | — | Serper.dev API key for Google Search |
| `DATABASE_URL` | Yes | — | Postgres (shared with API) |
| `OPENAI_API_KEY` | Yes | — | Embeddings (`text-embedding-3-small`) |
| `BROWSERBASE_API_KEY` | Yes (scrape) | — | Stagehand browser sessions |
| `BROWSERBASE_PROJECT_ID` | Yes (scrape) | — | Browserbase project |
| `ENV` | No | `LOCAL` | Stagehand env (`LOCAL` or `BROWSERBASE`) |
| `MODEL` | No | `openai/gpt-4o-mini` | Stagehand act/extract model |
| `TEMPORAL_ADDRESS` | No | `localhost:7233` | Temporal server |
| `TEMPORAL_NAMESPACE` | No | `default` | Temporal namespace |
| `TASK_QUEUE` | No | `prismapply-orchestration` | Worker task queue |
| `DISCOVERY_CRON_SCHEDULE` | No | `0 */6 * * *` | Cron expression (every 6h) |
| `DISCOVERY_MAX_SCRAPES_PER_RUN` | No | `50` | Cap new Stagehand scrapes per cron run |
| `DISCOVERY_SERPER_NUM_RESULTS` | No | `10` | Organic results per Serper query |

### End-to-end flow

```
┌─────────────────────────────────────────────────────────────────┐
│  Temporal Cron: discoverTechJobs (every 6h)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Load active rows from discovery_search_queries (by priority)   │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼  for each query                       │
┌──────────────────────┐                          │
│  searchGoogle(query) │  ← Serper POST /search   │
│  → organic links     │                          │
│  → filter ATS URLs   │                          │
└──────────────────────┘                          │
          │                                       │
          ▼                                       │
┌──────────────────────┐                          │
│  dedupJobUrls(urls)  │  ← check discovered_jobs │
│  known → last_seen   │                          │
│  new → scrape queue  │                          │
└──────────────────────┘                          │
          │                                       │
          ▼  for each NEW url (cap per run)       │
┌──────────────────────┐                          │
│ scrapeAndEnrichJob   │  ← Stagehand             │
│  • listing metadata  │                          │
│  • click Apply       │                          │
│  • extract form flds │                          │
└──────────────────────┘                          │
          │                                       │
          ▼                                       │
┌──────────────────────┐                          │
│  embedAndStoreJob    │  ← OpenAI embed + upsert │
│  discovered_jobs     │                          │
│  job_form_fields     │                          │
└──────────────────────┘                          │
          │                                       │
          ▼  net-new jobs only                    │
┌──────────────────────┐                          │
│ processDiscoveredJob │  ← existing workflow     │
│  matchJob → tailor   │                          │
└──────────────────────┘                          │
```

### Serper integration

**Endpoint:** `POST https://google.serper.dev/search`

**Request:**
```json
{
  "q": "site:jobs.lever.co \"software engineer\" remote",
  "num": 10
}
```

**Headers:** `X-API-KEY: ${SERPER_API_KEY}`, `Content-Type: application/json`

**Response used:** `organic[].link` — filter to ATS URL patterns before scrape.

**ATS URL patterns:**

| Platform | Pattern |
|----------|---------|
| Lever | `https://jobs.lever.co/{company}/{uuid}` |
| Greenhouse | `https://boards.greenhouse.io/{company}/jobs/{id}` or `https://job-boards.greenhouse.io/...` |
| Ashby | `https://jobs.ashbyhq.com/{company}/{uuid}` |

Normalize URLs (strip query/hash) before dedup.

### Curated search keywords

Stored in `discovery_search_queries`. Seed ~20–30 queries for the tech pilot.

**Query design rules:**
- Use `site:` operator to target one ATS per query
- Include role synonyms with `OR` (engineer, developer, etc.)
- Bake geography into the query string (`remote`, `"United States"`, `"London"`, etc.)
- Cover all tech verticals — no post-filter on title

**Seed examples:**

```
site:jobs.lever.co ("software engineer" OR "backend engineer" OR "full stack")
site:boards.greenhouse.io ("software engineer" OR "platform engineer")
site:jobs.ashbyhq.com ("software engineer" OR "data engineer")
site:jobs.lever.co "machine learning engineer" remote
site:boards.greenhouse.io "devops" OR "SRE"
site:jobs.lever.co "frontend" OR "mobile" OR "iOS" OR "Android"
site:boards.greenhouse.io "security engineer" OR "infosec"
site:jobs.ashbyhq.com "QA" OR "SDET" OR "test engineer"
site:jobs.lever.co "staff engineer" OR "principal engineer"
site:boards.greenhouse.io "technical program manager" OR "TPM"
site:jobs.ashbyhq.com "infrastructure engineer" OR "platform engineer"
site:jobs.lever.co "data scientist" OR "analytics engineer"
```

Expand over time by adding rows — no code changes needed.

### Workflows

#### `discoverTechJobs` (new — Temporal Cron)

**Schedule:** `DISCOVERY_CRON_SCHEDULE` (default every 6 hours)

**Logic:**
1. Fetch all `active` queries ordered by `priority`
2. For each query: `searchGoogle` → `dedupJobUrls` → collect new URLs
3. Stop collecting when scrape queue hits `DISCOVERY_MAX_SCRAPES_PER_RUN`
4. For each new URL: `scrapeAndEnrichJob` → `embedAndStoreJob`
5. For each stored jobId: start child workflow `processDiscoveredJob`
6. Update `discovery_search_queries.last_run_at` and `last_result_count`

**Error handling:** Per-query failures are logged and skipped; one bad query must not fail the entire run.

#### `processDiscoveredJob` (existing)

Unchanged — match users via pgvector, fan-out tailor.

### Activities (new)

| Activity | File (planned) | Input | Output |
|----------|----------------|-------|--------|
| `searchGoogle` | `activities/discovery/searchGoogle.ts` | `queryId`, `query` | `{ urls: string[] }` |
| `dedupJobUrls` | `activities/discovery/dedupJobUrls.ts` | `urls[]` | `{ newUrls[], knownUrls[] }` |
| `scrapeAndEnrichJob` | `activities/discovery/scrapeAndEnrichJob.ts` | `url` | `DiscoveredJobPayload` |
| `embedAndStoreJob` | `activities/discovery/embedAndStoreJob.ts` | `DiscoveredJobPayload` | `{ jobId: string, isNew: boolean }` |
| `loadDiscoveryQueries` | `activities/discovery/loadDiscoveryQueries.ts` | — | `DiscoveryQuery[]` |

**Scraper routing** (`scrapeAndEnrichJob`):
- Detect platform from URL hostname
- Delegate to `scrapers/lever.ts`, `scrapers/greenhouse.ts`, or `scrapers/ashby.ts`
- Port Lever scraper from `job-discovery/src/scraper/lever.ts`
- Each scraper returns: title, company, location, description, applyUrl, formFields

**Stagehand session:** One browser session per job URL (listing → apply → form extract). Reuse existing Browserbase config from orchestration `.env`.

### File layout (planned)

```
orchestration/src/
├── activities/
│   ├── discovery/
│   │   ├── searchGoogle.ts       # Serper client
│   │   ├── dedupJobUrls.ts
│   │   ├── scrapeAndEnrichJob.ts
│   │   ├── embedAndStoreJob.ts
│   │   └── loadDiscoveryQueries.ts
│   ├── scrapers/
│   │   ├── lever.ts                # port from job-discovery
│   │   ├── greenhouse.ts
│   │   ├── ashby.ts
│   │   └── detectPlatform.ts
│   ├── matchJob.ts                 # existing
│   └── tailorForUser.ts            # existing
├── workflows/
│   ├── discoverTechJobs.ts         # new cron workflow
│   ├── processDiscoveredJob.ts     # existing
│   └── processUserMatch.ts         # existing
├── config/
│   └── discovery.ts                # env parsing + defaults
└── worker.ts
```

### Database

**Migration `000012_discovery_search_queries.up.sql`:**

```sql
CREATE TABLE discovery_search_queries (
    id BIGSERIAL PRIMARY KEY,
    query TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    priority INT NOT NULL DEFAULT 100,
    last_run_at TIMESTAMPTZ,
    last_result_count INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE discovered_jobs
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS search_query_id BIGINT REFERENCES discovery_search_queries(id);
```

**Seed migration or SQL file** with initial tech keyword list.

**Dedup rules:**
- Unique on `(source, job_url)` — already exists
- Known URL on re-discovery → update `last_seen_at` only (no re-scrape, no re-embed, no re-match)
- New URL → full scrape + enrich + embed + trigger workflow

### Temporal cron registration

Register once (CLI or startup script):

```bash
temporal schedule create \
  --schedule-id discover-tech-jobs \
  --cron "0 */6 * * *" \
  --type discoverTechJobs \
  --task-queue prismapply-orchestration
```

Or register programmatically from a one-shot `orchestration/src/registerSchedules.ts` script.

### Implementation phases

#### Phase 1 — Serper + queries + workflow shell
- [ ] Add `orchestration/src/config/discovery.ts` (read `SERPER_API_KEY`, caps, cron)
- [ ] Add `searchGoogle` activity (Serper HTTP client)
- [ ] Migration: `discovery_search_queries` + seed data
- [ ] Migration: `discovered_jobs.last_seen_at`, `search_query_id`
- [ ] `loadDiscoveryQueries` + `dedupJobUrls` activities
- [ ] `discoverTechJobs` workflow (search + dedup only, log new URLs)
- [ ] Register Temporal cron schedule
- [ ] Manual test: `temporal workflow start --type discoverTechJobs`

#### Phase 2 — Scrape + enrich at ingest
- [ ] Port Lever scraper to `orchestration/src/activities/scrapers/lever.ts`
- [ ] Add Greenhouse + Ashby scrapers
- [ ] `scrapeAndEnrichJob` activity (Stagehand, platform routing)
- [ ] `embedAndStoreJob` activity (OpenAI embed + DB upsert)
- [ ] Wire `discoverTechJobs` → scrape → store → `processDiscoveredJob` child workflow

#### Phase 3 — Hardening + cleanup
- [ ] Per-query error isolation + structured logging
- [ ] Scrape cap enforcement (`DISCOVERY_MAX_SCRAPES_PER_RUN`)
- [ ] Metrics: queries run, URLs found, new vs known, scrape failures
- [x] Remove standalone `job-discovery/` service
- [ ] Update `start.sh` docs (discovery runs via Temporal cron, no separate process)

### Cost model (pilot)

| Resource | Estimate |
|----------|----------|
| Serper | ~30 queries × 4 runs/day = 120/day ≈ 3.6K/month (~$3–4/mo) |
| Stagehand/Browserbase | Dominant cost — 50 scrapes/run × 4 runs/day = 200/day max; dedup reduces over time |
| OpenAI embeddings | 1 embed per net-new job only |

### Observability

Log at each stage:
```
[discoverTechJobs] run started
[searchGoogle] query_id=3 urls=8
[dedupJobUrls] new=2 known=6
[scrapeAndEnrichJob] url=... platform=lever fields=12
[embedAndStoreJob] jobId=... isNew=true
[discoverTechJobs] run complete: queries=28 newJobs=5 scraped=5 errors=0
```

Query health via `discovery_search_queries.last_result_count` — alert if consistently 0.

