# Production Deploy — Design Spec

**Date:** 2026-07-07  
**Project:** onova-za-smetkata  
**Status:** Approved  
**Builds on:** `docs/superpowers/specs/2026-07-07-personal-bill-splitter-design.md`

## Summary

Make the app production-ready for Netlify deployment with Convex prod backend. Scope is **option B**: verified build config, env wiring, PWA icon polish, basic error handling, and a deploy runbook. Netlify site and Convex prod deployment already exist; no CI pipeline, auth, or access restrictions.

## Decisions

| Decision         | Choice                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| Scope            | Deploy + polish (not full CI/CD)                                                                     |
| Netlify + Convex | Both already provisioned                                                                             |
| Access control   | Open URL — unlisted link only; no auth, no password, no `noindex`                                    |
| PWA icons        | Generate from existing branding (sea-ink + lagoon on foam background)                                |
| Service worker   | None — online-only (unchanged from MVP)                                                              |
| Package manager  | npm for Netlify build (`package-lock.json` present); add `pnpm-lock.yaml` later if switching to pnpm |
| Preflight        | Local `npm run preflight` runs test + build before deploy                                            |
| Monitoring       | None (no Sentry)                                                                                     |

## Architecture

```
GitHub (main branch)
    │
    ├── Netlify site (TanStack Start + Netlify Functions)
    │     Build: npm run build → dist/client
    │     Env:   VITE_CONVEX_URL → Convex prod cloud URL
    │
    └── Convex prod deployment
          Tables: bills, participants, items, assignments, payments,
                  receiptScans, paymentSettings
          Storage: receipt photos
          Actions: Gemini receipt OCR
          Env:     GEMINI_API_KEY (required for OCR)
                   GEMINI_MODEL (optional)
```

**Secret placement:**

| Variable            | Where                                                      |
| ------------------- | ---------------------------------------------------------- |
| `VITE_CONVEX_URL`   | Netlify env (build-time, public in client bundle)          |
| `CONVEX_DEPLOYMENT` | Local `.env.local` + optional Netlify (CLI/deploy scripts) |
| `GEMINI_API_KEY`    | Convex Dashboard only — never Netlify or repo              |

**Security:** No authentication. Anyone with the URL can read and modify data. Acceptable for a personal unlisted deployment.

## Build & Netlify configuration

### `netlify.toml`

```toml
[build]
  command = "npm run build"
  publish = "dist/client"

[build.environment]
  NODE_VERSION = "22"

[dev]
  command = "npm run dev"
  targetPort = 3000
  port = 8888
```

Uses npm to match committed `package-lock.json`. Switch to pnpm only after adding `pnpm-lock.yaml`.

### `vite.config.ts`

Load `@tanstack/devtools-vite` only during dev (`command === 'serve'`). Production builds must not include devtools plugin overhead or accidental dev panels.

Keep existing plugins: `@netlify/vite-plugin-tanstack-start`, `@tailwindcss/vite`, `@tanstack/react-start`, `@vitejs/plugin-react`.

### Build-time env validation

Add a small module (e.g. `src/lib/env.ts`) that throws at build time if `import.meta.env.PROD && !import.meta.env.VITE_CONVEX_URL`. Import it from `src/integrations/convex/provider.tsx` so missing env fails the Netlify build instead of shipping a broken app.

### `.env.example`

Update with clear sections:

```
# Local development (.env.local)
CONVEX_DEPLOYMENT=your-dev-or-prod-name
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# Convex Dashboard → Settings → Environment Variables (production)
# GEMINI_API_KEY=...
# GEMINI_MODEL=gemini-2.5-flash  # optional

# Netlify → Site settings → Environment variables
# VITE_CONVEX_URL=https://your-prod-deployment.convex.cloud
```

## Deploy workflow

### One-time verification (already done by operator)

- [ ] Netlify site connected to GitHub repo
- [ ] Convex prod deployment exists
- [ ] `VITE_CONVEX_URL` set in Netlify to **prod** Convex URL
- [ ] `GEMINI_API_KEY` set in Convex prod dashboard

### Each release

1. **Local preflight:** `npm run preflight` (runs `vitest run` + `vite build`)
2. **Deploy Convex:** `npx convex deploy` with `CONVEX_DEPLOYMENT` pointing at the prod deployment (see Convex docs / dashboard)
3. **Deploy frontend:** push to `main` → Netlify auto-build
4. **Smoke test:** run post-deploy checklist (below)

Document full steps in `docs/DEPLOY.md` and link from README.

## PWA polish

### Generated assets

Create PNG icons using existing CSS brand tokens:

| File                          | Size    | Notes            |
| ----------------------------- | ------- | ---------------- |
| `public/icon-192.png`         | 192×192 | Home screen      |
| `public/icon-512.png`         | 512×512 | Splash / install |
| `public/apple-touch-icon.png` | 180×180 | iOS              |

Visual: foam/off-white background (`#f3faf5`), rounded square, lagoon accent (`#4fb8b2`), sea-ink (`#173a40`) „С“ or receipt motif. Simple flat vector — no external design tool required (generate via script or SVG → PNG export).

### `public/manifest.json`

- Add `icons` entries for 192 and 512 with `type: "image/png"`
- Add `"purpose": "any maskable"` on 512 entry
- Keep `short_name`, `name`, `display: standalone`, theme/background colors

### `src/routes/__root.tsx` head

Add link:

```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
```

Optional: `favicon.ico` remains for browser tab.

No service worker registration.

## Error handling

### Root route error boundary

Add `errorComponent` to `createRootRoute` in `__root.tsx`:

- Bulgarian heading: „Нещо се обърка“
- Short explanation
- Button „Опитай отново“ → `window.location.reload()`
- Show error message in dev only (`import.meta.env.DEV`)

Use existing Shadcn `Button` + layout consistent with app shell.

### Convex provider fallback

When `VITE_CONVEX_URL` is missing at runtime (should not happen after build validation):

- Render a centered message instead of crashing silently
- Text: „Липсва конфигурация на сървъра (VITE_CONVEX_URL).“

### Mutation error audit

Ensure these flows show `toast.error` on failure (add if missing):

- `bills.finalize` (summary)
- `bills.remove` (summary + home bill card)
- `bills.create` (home)
- `paymentSettings.save` (already has toast)

No new global error reporting service.

## Documentation

### Replace `README.md` boilerplate

Sections:

1. **Онова за сметката** — one-paragraph description (Bulgarian bill splitter PWA)
2. **Local development** — `npm install`, `.env.local`, `npm run dev` + `npx convex dev`
3. **Deploy** — link to `docs/DEPLOY.md`
4. **Testing** — `npm test`
5. **Tech stack** — TanStack Start, Convex, Netlify, Shadcn

### `docs/DEPLOY.md`

- Prerequisites checklist
- Env var table (Netlify vs Convex)
- Step-by-step release process
- Post-deploy smoke test checklist
- Troubleshooting (blank page = missing `VITE_CONVEX_URL`; OCR fails = missing `GEMINI_API_KEY`)

## Preflight script

Add to `package.json`:

```json
"preflight": "npm run test && npm run build"
```

Optional: small Node script that validates `VITE_CONVEX_URL` is set when running build locally (Netlify sets it in CI).

## Post-deploy smoke test

Manual checklist after each production deploy:

- [ ] Home page loads; bill list queries Convex
- [ ] Create new bill → editor opens
- [ ] Add participant + item + assignment
- [ ] Sticky totals bar shows correct amounts
- [ ] Summary page loads; finalize works (with restaurant name)
- [ ] Mark participant paid
- [ ] Payment settings (Revolut/IBAN) save and persist (Convex `paymentSettings`)
- [ ] Receipt OCR scan works (requires `GEMINI_API_KEY`)
- [ ] „Add to Home Screen“ shows new icon (mobile)
- [ ] No TanStack devtools panel visible
- [ ] Summary page bottom actions not clipped on mobile viewport

## Files to create or modify

| File                                   | Action                                         |
| -------------------------------------- | ---------------------------------------------- |
| `netlify.toml`                         | Update build command to pnpm, add NODE_VERSION |
| `vite.config.ts`                       | Conditional devtools plugin                    |
| `package.json`                         | Add `preflight` script                         |
| `src/lib/env.ts`                       | Build-time env validation (new)                |
| `src/integrations/convex/provider.tsx` | Import env validation; runtime fallback UI     |
| `src/routes/__root.tsx`                | Error boundary; apple-touch-icon link          |
| `public/manifest.json`                 | New icon entries                               |
| `public/icon-192.png`                  | New                                            |
| `public/icon-512.png`                  | New                                            |
| `public/apple-touch-icon.png`          | New                                            |
| `.env.example`                         | Clarify Netlify vs Convex env split            |
| `README.md`                            | Replace boilerplate                            |
| `docs/DEPLOY.md`                       | New deploy runbook                             |

## Out of scope

- User authentication or Netlify password protection
- `noindex` / search-engine blocking
- GitHub Actions CI/CD
- Staging/preview Convex deployment automation
- Service worker / offline support
- Custom domain configuration
- Sentry or other monitoring
- Migrating data from Convex dev to prod
- Rate limiting or abuse protection

## Acceptance criteria

1. `npm run preflight` passes locally with prod-like `VITE_CONVEX_URL` set
2. Netlify production build succeeds using `npm run build`
3. Production site connects to Convex prod (not dev) URL
4. Root error boundary shows friendly Bulgarian message on uncaught route errors
5. Missing `VITE_CONVEX_URL` fails build, not silent runtime failure
6. PWA manifest references 192/512 PNG icons; iOS apple-touch-icon works
7. `docs/DEPLOY.md` documents full release process
8. README describes the project (not TanStack boilerplate)
9. Devtools plugins absent from production bundle
10. Post-deploy smoke test checklist is documented and executable
