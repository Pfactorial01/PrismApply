# PrismApply Marketing

Static landing site for **prismapply.com**. The product app lives in `../frontend/` (**app.prismapply.com**).

## Stack

- [Astro](https://astro.build) (static output)
- Tailwind CSS v4 + Inter (matches app brand tokens)

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

For local dev, point `PUBLIC_APP_URL` at `http://localhost:5173`.

## Cloudflare Pages

| Setting | Value |
|---------|-------|
| Root directory | `marketing` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment | `PUBLIC_SITE_URL`, `PUBLIC_APP_URL` |

## Structure

```
src/
  components/   Header, Hero, HowItWorks, Features, Cta, Footer
  layouts/      BaseLayout.astro
  pages/        index.astro
  config.ts     Site copy + app URL helpers
public/         favicon.svg
```

Add new pages under `src/pages/` (e.g. `pricing.astro` → `/pricing`).
