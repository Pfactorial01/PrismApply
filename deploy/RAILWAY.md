# Railway deployment

Deploy PrismApply on [Railway](https://railway.com) as a multi-service project. This repo includes Dockerfiles, `railway.toml` configs, and an optional **nginx gateway** for routing.

## CLI deploy (`railway up`) vs GitHub deploy

| Method | Command | Config paths |
|--------|---------|----------------|
| **CLI with `--path-as-root`** | `railway up ./frontend --path-as-root --service frontend` | Service **Root Directory** = empty, **Config file** = `/railway.toml` (file at upload root) |
| **GitHub auto-deploy** | push to `main` | Service **Root Directory** = `frontend`, **Config file** = `/frontend/railway.toml` |

If you see `service config at '/frontend/railway.toml' not found` and builder **RAILPACK** (not Dockerfile), Railway couldn't find the config in the uploaded bundle — usually because `--path-as-root` was used while the service still pointed at monorepo paths.

**Do not** use `railway up` from repo root without `--path-as-root` unless you accept a ~15 MB upload (often times out). Prefer `--path-as-root` or GitHub deploys.

---

Railway is **not** a path-based ingress like Kubernetes. Each service gets:

| Layer | Behavior |
|-------|----------|
| **Public networking** | One HTTPS URL per service (`*.up.railway.app` + custom domains you attach) |
| **Private networking** | Services reach each other at `{service-name}.railway.internal:{PORT}` |
| **Cron** | Scheduled one-shot runs (discover) — process must exit when done |

Railway does **not** route `/api` on `app.example.com` to a different service automatically. You have two patterns:

### Pattern A — nginx gateway (recommended)

One public service (`gateway`) routes by **Host** header to private upstreams:

```
                    ┌─────────────────────────────────────┐
  prismapply.com ──►│  gateway (deploy/nginx)             │
  app.prismapply.com│    ├─ /api/*  → api (private)       │
                    │    └─ /*      → frontend (private)  │
                    └─────────────────────────────────────┘
  prismapply.com ──► marketing (private, via gateway host rule)
```

**Benefits**

- Same-origin `/api` on `app.prismapply.com` — HttpOnly cookies work without `COOKIE_DOMAIN`
- Leave `VITE_API_BASE_URL` unset in the frontend build
- One place for TLS, body size limits, and timeouts

**Setup**

1. Deploy `api`, `frontend`, `marketing` with **public networking disabled**
2. Deploy `gateway` with public networking **enabled**
3. Attach custom domains to **gateway only**:
   - `app.prismapply.com`
   - `prismapply.com`
4. Set gateway env vars (see [Gateway env](#gateway-env))

Service names matter for default private DNS. Name Railway services exactly: `api`, `frontend`, `marketing` — or override `API_HOST`, `FRONTEND_HOST`, etc.

### Pattern B — per-service domains (no nginx)

Attach domains directly to each service:

| Domain | Service |
|--------|---------|
| `api.prismapply.com` | api |
| `app.prismapply.com` | frontend |
| `prismapply.com` | marketing |

Set on the API:

```
COOKIE_SECURE=true
COOKIE_DOMAIN=.prismapply.com
```

Set on frontend **build**:

```
VITE_API_BASE_URL=https://api.prismapply.com
```

No gateway needed; auth relies on shared cookie domain.

---

## Services overview

| Railway service | Root directory | Config file | Public? |
|-----------------|----------------|-------------|---------|
| Postgres | Template: pgvector | — | No |
| Redis | Plugin | — | No |
| **api** | `api` | `api/railway.toml` | No (A) / Yes (B) |
| **embed-worker** | `api` | `deploy/railway/embed-worker.toml` | No |
| **jobworker** | `api` | `deploy/railway/jobworker.toml` | No |
| **discover** | `api` | `deploy/railway/discover.toml` | No |
| **frontend** | `frontend` | `frontend/railway.toml` | No (A) / Yes (B) |
| **marketing** | `marketing` | `marketing/railway.toml` | No (A) / Yes (B) |
| **gateway** | `deploy/nginx` | `deploy/nginx/railway.toml` | Yes (pattern A only) |

To use a config file outside the service root, set **Settings → Config file path** in the Railway dashboard.

---

## First-time setup

### 1. Create project + data stores

1. New Railway project from this GitHub repo.
2. Add **Postgres** → use the **pgvector** template (required for embeddings).
3. Add **Redis** plugin.

### 2. Deploy backend services (root `api/`)

Create four services from the same repo root directory `api/`:

| Service name | Config file | Notes |
|--------------|-------------|-------|
| `api` | `api/railway.toml` | Runs migrations on boot |
| `embed-worker` | `deploy/railway/embed-worker.toml` | Always on |
| `jobworker` | `deploy/railway/jobworker.toml` | ≥1 GB RAM, Chrome in image |
| `discover` | `deploy/railway/discover.toml` | Cron every 6h UTC |

Attach the [shared env group](railway/shared.env.example) to all four. Minimum:

```
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<long random string>
COOKIE_SECURE=true
OPENAI_API_KEY=...
R2_*=...
SERPER_API_KEY=...   # discover only, but fine on all
CHROME_PATH=/usr/bin/chromium
```

Set `PORT=8080` on **api** (Railway injects `PORT`; the Go API reads it).

### 3. Deploy frontends

**frontend** (root `frontend/`):

- Pattern A: no `VITE_API_BASE_URL` (same-origin via gateway)
- Pattern B: `VITE_API_BASE_URL=https://api.prismapply.com`

**marketing** (root `marketing/`):

```
PUBLIC_SITE_URL=https://prismapply.com
PUBLIC_APP_URL=https://app.prismapply.com
```

Disable public networking for pattern A.

### 4. Deploy gateway (pattern A)

Root directory: `deploy/nginx`

### Gateway env

```
APP_HOST=app.prismapply.com
MARKETING_HOST=prismapply.com
API_HOST=${{api.RAILWAY_PRIVATE_DOMAIN}}
API_PORT=${{api.PORT}}
FRONTEND_HOST=${{frontend.RAILWAY_PRIVATE_DOMAIN}}
FRONTEND_PORT=${{frontend.PORT}}
MARKETING_UPSTREAM_HOST=${{marketing.RAILWAY_PRIVATE_DOMAIN}}
MARKETING_UPSTREAM_PORT=${{marketing.PORT}}
```

Attach both custom domains to the **gateway** service in Railway → Settings → Domains.

---

## Deploy order

1. Postgres + Redis  
2. `api` → check `GET /health` on private URL or after gateway  
3. `embed-worker` + `jobworker`  
4. `frontend` + `marketing`  
5. `gateway` (pattern A)  
6. `discover` — run manually once, then enable cron  

---

## Local Docker smoke tests

From repo root:

```bash
make -C api docker-build
make -C api docker-build-embed-worker
make -C api docker-build-jobworker
make -C api docker-build-discover
docker build -t prismapply-frontend ./frontend
docker build -t prismapply-marketing ./marketing
docker build -t prismapply-gateway ./deploy/nginx
```

---

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| 401 on every API call (pattern A) | Gateway missing `Host` / cookie path; ensure frontend calls `/api` not external URL |
| Redis NOAUTH | Set `REDIS_URL=${{Redis.REDIS_URL}}` not bare `REDIS_ADDR` |
| Tailor fails | jobworker RAM too low; check `CHROME_PATH=/usr/bin/chromium` |
| Discover skipped | Previous cron run still active (long scrape batch) |
| pgvector error | Wrong Postgres template — need pgvector extension |

---

## Files added by this setup

```
api/Dockerfile                  # HTTP API (distroless)
api/Dockerfile.embed-worker     # Embed worker
api/Dockerfile.chrome           # jobworker + discover (build arg CMD_PATH)
api/railway.toml
frontend/Dockerfile             # Static SPA (internal nginx)
frontend/railway.toml
marketing/Dockerfile
marketing/railway.toml
deploy/nginx/                   # Public gateway (pattern A)
deploy/railway/                 # Worker cron configs + shared.env.example
```
