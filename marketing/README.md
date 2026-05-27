# PrismApply Marketing

Static landing site for **prismapply.com**. The product app lives in `../frontend/` (**app.prismapply.com**).

## Stack

- [Astro](https://astro.build) (static output)
- Tailwind CSS v4 + Inter (matches app brand tokens)
- `@astrojs/sitemap` for `sitemap-index.xml`

## Commands

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # output → dist/
npm run preview  # preview production build
```

## Environment

Copy `.env.example` → `.env`:

| Variable | Purpose |
|----------|---------|
| `PUBLIC_SITE_URL` | Canonical marketing URL (`https://prismapply.com`) |
| `PUBLIC_APP_URL` | Product app URL for login/signup CTAs (`https://app.prismapply.com`) |
| `PUBLIC_POSTHOG_KEY` | PostHog project API key (optional) |
| `PUBLIC_POSTHOG_HOST` | PostHog ingest URL (`https://us.i.posthog.com` or `https://eu.i.posthog.com`) |

For local dev, point `PUBLIC_APP_URL` at `http://localhost:5173`.

**Production:** Cloudflare Pages / Railway must set `PUBLIC_APP_URL=https://app.prismapply.com` on every deploy. CTAs are baked in at build time — a build without this env var will point at localhost.

## SEO pages

| Path | Purpose |
|------|---------|
| `/` | Homepage + SoftwareApplication JSON-LD |
| `/how-it-works` | Tailoring at scale explainer |
| `/faq` | FAQ + FAQPage schema |
| `/for/software-engineers` | Role landing |
| `/vs/auto-apply` | Comparison / LazyApply alternative |
| `/truthful-ai-resume` | Truth pledge niche |
| `/pricing` | Beta pricing |
| `/privacy`, `/terms` | Legal |
| `/blog` | Content hub (8 launch posts) |

Technical SEO: `public/robots.txt`, auto-generated sitemap, `og-image.svg`, Open Graph + Twitter cards on all pages.

## Analytics funnel (PostHog)

Use the **same project API key** on marketing and app for a cross-domain funnel (`prismapply.com` → `app.prismapply.com`).

| Event | Where |
|-------|--------|
| `Signup Click` | Marketing CTAs (prop: `location`) |
| `Signup Complete` | App signup (prop: `source` from `?ref=`) |
| `Profile Step 1` | Profile wizard loaded |
| `Profile Submit` | Profile submitted |
| `First Match` | First tailored application appears |
| `First Package Viewed` | First application detail view |

In PostHog → **Product analytics → Insights**, build a funnel with the events above.

## Cloudflare Pages

| Setting | Value |
|---------|-------|
| Root directory | `marketing` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment | `PUBLIC_SITE_URL`, `PUBLIC_APP_URL`, `PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST` |

## Structure

```
src/
  components/   Header, Hero, SignupLink, Analytics, …
  content/blog/ Markdown posts
  data/         Shared FAQ content
  layouts/      BaseLayout, PageLayout
  lib/          SEO helpers
  pages/        Routes + blog/[slug].astro
public/         favicon, og-image, robots.txt
```

Add new pages under `src/pages/` (e.g. `pricing.astro` → `/pricing`).
