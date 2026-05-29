# PrismApply

Tell your story once. PrismApply discovers matching job postings and prepares tailored, truthful application packages for each one — resume PDF, cover letter, and ATS form-field answers grounded in your profile.

## Repository layout

| Directory | Description |
|-----------|-------------|
| [`api/`](api/) | Go backend: HTTP API, embed worker, job worker, discovery cron, CLI tools |
| [`frontend/`](frontend/) | React + Vite product app (`app.prismapply.com`) |
| [`marketing/`](marketing/) | Astro static marketing site (`prismapply.com`) |
| [`deploy/`](deploy/) | Railway configs, nginx gateway, deployment docs |

## Architecture (short)

```text
User profile → embed worker → reverse match (recent jobs)
Discovery (Serper + scrape) → new jobs → forward match → job worker → tailor pipeline → applications UI
```

- **Postgres + pgvector** — users, profiles, section embeddings, discovered jobs, matches, tailored applications
- **Redis** — profile embed queue, match/tailor queues, refresh tokens
- **OpenAI** — embeddings and LLM tailoring / match adjudication
- **Cloudflare R2** — resume and cover letter PDFs
- **Serper** — job discovery search (optional locally)

See [`deploy/RAILWAY.md`](deploy/RAILWAY.md) for production deployment on Railway.

## Prerequisites

- **Go 1.22+** (backend)
- **Node.js 20+** (frontend and marketing)
- **PostgreSQL** with the [pgvector](https://github.com/pgvector/pgvector) extension
- **Redis**
- API keys as needed: OpenAI, R2, Serper (discovery), etc.

## Local development

### 1. Configure the API

```bash
cp api/env.example api/.env
# Edit api/.env: DATABASE_URL, JWT_SECRET, REDIS_*, OPENAI_API_KEY, etc.
```

Run migrations automatically when the API starts (`cmd/api`).

For Redis without a password during dev, you can use a separate instance and `make -C api run-dev-redis` / `run-worker-dev-redis` (see `api/Makefile`).

### 2. Install dependencies

```bash
cd api && go mod download
cd ../frontend && npm install
cd ../marketing && npm install
```

### 3. Start everything

From the repo root:

```bash
./local_start.sh
```

This starts the API, embed worker, job worker, optional discovery loop, frontend, and marketing site. Logs go to `logs/`. Press **Ctrl+C** to stop all processes.

| Service | URL |
|---------|-----|
| App | http://localhost:5173 |
| Marketing | http://localhost:4321 |
| API (default) | http://localhost:9001 |

Set `DISCOVERY_ENABLED=false` in `api/.env` to skip the discovery loop. Override the interval with `DISCOVERY_INTERVAL_HOURS` (default `6`).

### Run services individually

```bash
make -C api run              # HTTP API
make -C api run-worker       # Profile embeddings + reverse match
make -C api run-jobworker    # Tailoring + forward job processing
make -C api run-discover     # One-shot discovery run

cd frontend && npm run dev
cd marketing && npm run dev
```

## API overview

Main routes (see [`api/internal/server/server.go`](api/internal/server/server.go)):

- `POST /api/auth/signup`, `login`, `logout`, `refresh` — cookie-based JWT sessions
- `GET|PUT /api/profile`, `POST /api/profile/submit` — applicant profile (submit enqueues embedding)
- `GET /api/applications`, PDF downloads, `PATCH .../mark-sent`
- `GET|PATCH /api/settings` — match tier and stretch preferences

Background binaries: `cmd/worker`, `cmd/jobworker`, `cmd/discover`. Environment reference: [`api/env.example`](api/env.example).

## Frontend

React 19, TanStack Router + Query, Tailwind v4. Authenticated routes require a complete profile before showing matches and applications.

```bash
cd frontend && npm run dev
```

Optional build-time env: `VITE_API_BASE_URL` (empty = same origin / Vite proxy), PostHog keys — see [`frontend/README.md`](frontend/README.md).

## Marketing site

```bash
cd marketing && npm run dev
```

Copy [`marketing/.env.example`](marketing/.env.example) → `.env` for `PUBLIC_SITE_URL`, `PUBLIC_APP_URL`, and analytics. Details: [`marketing/README.md`](marketing/README.md).

## Production deployment

Multi-service Railway setup (Postgres pgvector, Redis, api, workers, frontends, optional nginx gateway):

**[deploy/RAILWAY.md](deploy/RAILWAY.md)**

Do **not** set Railway start commands to `local_start.sh` — that script is for local development only.

## License

Proprietary — all rights reserved unless otherwise noted in the repository.
