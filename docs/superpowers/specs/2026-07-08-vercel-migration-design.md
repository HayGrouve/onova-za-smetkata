# Vercel Migration Design

**Status:** Approved  
**Date:** 2026-07-08  
**Goal:** Replace Netlify with Vercel for frontend hosting while keeping Convex as the backend. Verify on `*.vercel.app` before attaching `onova-za-smetkata.com`.

---

## Decisions

| Decision             | Choice                                                                |
| -------------------- | --------------------------------------------------------------------- |
| Hosting              | Fully replace Netlify (no parallel production hosts)                  |
| Domain cutover       | Deploy to `*.vercel.app` first; attach custom domain after smoke test |
| Backend              | Convex prod unchanged (auth callbacks stay on `*.convex.site`)        |
| Domain registrar/DNS | Vercel (domain already purchased there)                               |
| Build adapter        | Nitro with `preset: 'vercel'` (official TanStack Start path)          |

---

## Architecture

```
User browser
    │
    ▼
Vercel (TanStack Start SSR + static CDN)
    │  VITE_CONVEX_URL at build time
    ▼
Convex prod
    ├── Auth (Google, Resend magic link) → callbacks on *.convex.site
    ├── Database, mutations, real-time queries
    └── Receipt OCR → Gemini API

Optional: Sentry (VITE_SENTRY_DSN on Vercel)
Email DNS: Resend records remain on Vercel DNS
```

**Unchanged:** Convex schema, auth providers, guest sessions, rate limits, PWA manifest/icons, Playwright E2E against local dev.

**Removed:** Netlify site, `@netlify/vite-plugin-tanstack-start`, `netlify.toml`, Netlify env vars, manual A/CNAME records pointing to Netlify.

---

## Code changes

| File             | Change                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `vite.config.ts` | Remove `netlify()` plugin; add `nitro({ preset: 'vercel' })` from `nitro/vite`                |
| `package.json`   | Remove `@netlify/vite-plugin-tanstack-start`; add `nitro`; update `deploy` script description |
| `netlify.toml`   | Delete                                                                                        |
| `src/lib/env.ts` | Update error copy: Vercel instead of Netlify                                                  |
| `docs/DEPLOY.md` | Rewrite for Vercel deployment and domain steps                                                |
| `README.md`      | Hosting section → Vercel                                                                      |
| `.env.example`   | Netlify section → Vercel section                                                              |
| `.cta.json`      | Replace `netlify` add-on reference if present                                                 |

**Out of scope:** Feature work, Convex schema, auth logic, production launch tasks not related to hosting.

---

## Vercel project configuration

1. Import GitHub repo into Vercel (new project, same repository).
2. Framework: TanStack Start (auto-detected once Nitro plugin is present).
3. Package manager: pnpm (`pnpm-lock.yaml` must be committed and in sync).
4. Node.js version: 22.
5. Build command: `pnpm run build` (default with Nitro).
6. No manual output directory — Vercel + Nitro handle SSR output.

### Environment variables (Vercel → Production)

| Variable          | Required                | When                                                                   |
| ----------------- | ----------------------- | ---------------------------------------------------------------------- |
| `VITE_CONVEX_URL` | Yes                     | Before first deploy                                                    |
| `VITE_SENTRY_DSN` | No                      | Before first deploy if using Sentry                                    |
| `VITE_APP_ORIGIN` | No until domain cutover | Set to `https://onova-za-smetkata.com` after Phase 2; triggers rebuild |

Never set on Vercel: `GEMINI_API_KEY`, JWT keys, OAuth secrets, `DEV_MODE`.

### Environment variables (Convex prod)

| Variable   | Phase 1 (`*.vercel.app`)                                                      | Phase 2 (custom domain)                                 |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------------------------- |
| `SITE_URL` | Can stay on old URL temporarily; magic links may use wrong base until Phase 2 | **`https://onova-za-smetkata.com`** (no trailing slash) |

Google OAuth redirect URIs remain on Convex (`https://<prod-deployment>.convex.site/api/auth/callback/google`) — no change for Vercel migration.

---

## Cutover sequence

### Phase 1 — Vercel works (no custom domain)

1. Implement Nitro migration in repo.
2. Run locally: `pnpm run check && pnpm run lint && pnpm run preflight`.
3. Push to `main`; Vercel auto-deploys.
4. Smoke test on `https://<project>.vercel.app`:
   - Home loads; sign-in (Google + magic link if configured)
   - Create bill → participant → item → assign
   - Guest join URL (uses `window.location.origin` on client — OK on vercel.app)
   - PWA manifest and icons load
   - 404 page on unknown routes
5. Do **not** attach custom domain until Phase 1 passes.

### Phase 2 — Custom domain

1. Vercel project → **Settings → Domains** → add `onova-za-smetkata.com` and `www.onova-za-smetkata.com`.
2. Vercel DNS: remove manual records pointing to Netlify:
   - Delete **A** `@` → `75.2.60.5`
   - Delete **CNAME** `www` → `onova-za-smetkata.netlify.app`
   - Allow Vercel-managed ALIAS on `@` (normal for domains assigned to a Vercel project).
3. Set primary domain (recommend apex `onova-za-smetkata.com`; redirect `www` → apex or vice versa — pick one).
4. Wait for Vercel SSL provisioning.
5. Convex prod: `SITE_URL=https://onova-za-smetkata.com`.
6. Vercel: `VITE_APP_ORIGIN=https://onova-za-smetkata.com` → trigger redeploy.
7. Smoke test full checklist on `https://onova-za-smetkata.com` (including QR/share join links).

### Phase 3 — Decommission Netlify

1. Netlify → Domain management → remove custom domains from site.
2. Disable Netlify continuous deployment or delete site.
3. Remove Netlify environment variables.
4. Optional: remove Netlify GitHub integration.

---

## Testing

### Pre-merge (local / CI)

```bash
pnpm run check && pnpm run lint && pnpm run preflight
```

CI (`.github/workflows/ci.yml`) continues to run preflight; no Netlify-specific steps required.

### Phase 1 smoke (`*.vercel.app`)

- App loads over HTTPS
- Host auth and guest flows work
- No blank page / missing `VITE_CONVEX_URL` message
- Sentry receives test error (if configured)

### Phase 2 smoke (custom domain)

- Full `docs/DEPLOY.md` production checklist on `https://onova-za-smetkata.com`
- Join links in QR/share use custom domain (verify `VITE_APP_ORIGIN` after redeploy)
- Magic link emails use correct `SITE_URL`

### E2E

`pnpm run test:e2e` remains local-only (Convex dev + `DEV_MODE`); no change to Playwright config required for Vercel migration.

---

## Rollback

| Phase         | Rollback                                                                                 |
| ------------- | ---------------------------------------------------------------------------------------- |
| Phase 1 fails | Do not attach domain; fix Nitro/build; Netlify still serves production if unchanged      |
| Phase 2 fails | Revert Vercel domain assignment; temporarily restore Netlify DNS A/CNAME if needed       |
| After Phase 3 | Rollback requires re-pointing DNS and re-enabling Netlify — avoid until Vercel is stable |

---

## Risks and mitigations

| Risk                               | Mitigation                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| SSR 404 on Vercel                  | Use Nitro `preset: 'vercel'`; do not add conflicting `vercel.json` rewrites     |
| Build fails without env            | Keep `assertConvexUrlForBuild()` in `src/lib/env.ts`                            |
| Apex domain `DEPLOYMENT_NOT_FOUND` | Assign domain to Vercel **project**, not DNS-only                               |
| Auth redirect mismatch             | Update Convex `SITE_URL` in same window as domain cutover                       |
| Stale Netlify DNS                  | Remove A/CNAME to Netlify before relying on Vercel domain                       |
| Resend email breaks                | Keep existing Resend TXT/MX records on Vercel DNS; do not delete during cutover |

---

## Success criteria

1. `pnpm run preflight` passes after migration.
2. Production app served from Vercel on `*.vercel.app` with all critical flows working.
3. `https://onova-za-smetkata.com` serves the app with valid HTTPS.
4. Netlify production deploy disabled; no traffic to Netlify.
5. `docs/DEPLOY.md` documents Vercel-only deployment.

---

## References

- [Vercel: TanStack Start](https://vercel.com/docs/frameworks/full-stack/tanstack-start)
- [TanStack Start hosting guide](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- Existing production launch spec: `docs/superpowers/specs/2026-07-08-production-launch-design.md`
