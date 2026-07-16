# Deploy Runbook

## Prerequisites (one-time)

- [ ] GitHub repo connected to Vercel (PR previews OK; **production** deploys are owned by GitHub Actions)
- [ ] Convex **production** deployment exists
- [ ] Vercel env: `VITE_CONVEX_URL` = prod Convex cloud URL
- [ ] Convex prod env: `GEMINI_API_KEY` (for receipt OCR)
- [ ] Convex prod auth env vars (see below)
- [ ] Google OAuth redirect URI includes prod Convex site callback
- [ ] Resend domain verified; `AUTH_RESEND_FROM` set on prod Convex
- [ ] Optional: `VITE_SENTRY_DSN` on Vercel for client error tracking
- [ ] GitHub Actions secrets for production release (see below)
- [ ] `vercel.json` in repo sets `git.deploymentEnabled.main: false` so a push to `main` does **not** auto-deploy production on Vercel

## Environment variables

| Variable             | Where                           | Required                                                           |
| -------------------- | ------------------------------- | ------------------------------------------------------------------ |
| `VITE_CONVEX_URL`    | Vercel                          | Yes                                                                |
| `VITE_APP_ORIGIN`    | Vercel                          | Yes for production OG/share URLs (`https://onova-za-smetkata.com`) |
| `VITE_SENTRY_DSN`    | Vercel                          | No (Sentry client errors in production)                            |
| `GEMINI_API_KEY`     | Convex Dashboard                | Yes (for OCR)                                                      |
| `GEMINI_MODEL`       | Convex Dashboard                | No                                                                 |
| `SITE_URL`           | Convex Dashboard (prod)         | Yes (auth; production HTTPS URL)                                   |
| `JWT_PRIVATE_KEY`    | Convex Dashboard (prod)         | Yes (auth; generate via `npx @convex-dev/auth`)                    |
| `JWKS`               | Convex Dashboard (prod)         | Yes (auth)                                                         |
| `AUTH_GOOGLE_ID`     | Convex Dashboard (prod)         | Yes (Google sign-in)                                               |
| `AUTH_GOOGLE_SECRET` | Convex Dashboard (prod)         | Yes                                                                |
| `AUTH_RESEND_KEY`    | Convex Dashboard (prod)         | Yes (magic link email)                                             |
| `AUTH_RESEND_FROM`   | Convex Dashboard (prod)         | No (defaults to Resend onboarding address)                         |
| `DEV_MODE`           | Convex Dashboard (**dev only**) | No — auto sign-in as `Dev User`; **never enable in production**    |
| `CONVEX_DEPLOYMENT`  | Local `.env.local`              | Yes for local `npx convex` CLI                                     |
| `CONVEX_DEPLOY_KEY`  | GitHub Actions secret           | Yes — production deploy key (`deployment:deploy`)                  |
| `VERCEL_TOKEN`       | GitHub Actions secret           | Yes — Vercel access token for CLI deploys                          |
| `VERCEL_ORG_ID`      | GitHub Actions secret           | Yes                                                                |
| `VERCEL_PROJECT_ID`  | GitHub Actions secret           | Yes                                                                |

Never put `GEMINI_API_KEY`, JWT keys, OAuth secrets, `DEV_MODE`, or deploy keys/tokens in the repo.

### Security notes

- **Share tokens:** Guest join links require `?t={shareToken}` (e.g. `/bills/{id}/join?t=...`). The token is rotatable from the host invite card (“Обнови линка”). After deploying the share-token schema, run `npx convex run backfill:shareTokens` on each environment once.
- **Capability URLs:** Share join links only with people at the table. Rotating the token invalidates leaked links.
- **Guest sessions:** Assignment mutations require a valid guest session token or host auth. Expired sessions must re-claim a name on the join page.
- **Guest payment privacy:** `getForGuest` returns `myPayments` only — never the full payments list.
- **DEV_MODE:** Password provider is enabled only when `DEV_MODE=true` on an **explicit dev deployment allowlist** (`striped-shepherd-984` plus optional `CONVEX_DEV_DEPLOYMENTS`). Never set `DEV_MODE=true` on production.
- **Guest identity risk:** Guest names are claimable without accounts; if a session expires (~90s without heartbeat), another device can claim the same name. Document as accepted product risk for accountless guests.
- **Rate limits:** Guest claims are limited per actor and per bill; assignment toggles, heartbeats, releases, and receipt uploads are rate-limited server-side.
- **Cleanup cron:** `cleanup.run` purges expired guest sessions, stale rate-limit buckets, and old terminal receipt scans every 6 hours (registered in `convex/crons.ts`).

### Google OAuth redirect URI (production)

Add this authorized redirect URI in Google Cloud Console:

`https://<your-prod-deployment>.convex.site/api/auth/callback/google`

Example: `https://coordinated-warbler-782.convex.site/api/auth/callback/google`

### Sentry

1. Create a Sentry project (React).
2. Set `VITE_SENTRY_DSN` on Vercel.
3. After deploy, trigger a test error and confirm it appears in Sentry.

### Resend

Verify your sending domain in Resend, then set on **production** Convex:

```
AUTH_RESEND_FROM=Онова за сметката <noreply@yourdomain.com>
```

## Vercel project setup

1. Import the GitHub repo in [Vercel](https://vercel.com).
2. Framework: TanStack Start (auto-detected with Nitro plugin).
3. Package manager: pnpm.
4. Node.js: 22 (set in project settings if needed).
5. Environment variables (Production) — used by `vercel pull` / `vercel build` in Actions:
   - `VITE_CONVEX_URL=https://coordinated-warbler-782.convex.cloud`
   - `VITE_APP_ORIGIN=https://onova-za-smetkata.com` (required for correct OG previews)
   - Optional: `VITE_SENTRY_DSN`
6. Production Git auto-deploys for `main` are **off** (`vercel.json` → `git.deploymentEnabled.main: false`). PR preview deploys from Git stay enabled. Production releases are triggered only by the GitHub Actions workflow after Convex succeeds.

## Release steps

Canonical production path: **merge (or push) to `main` → GitHub Actions `preflight` → Convex prod → Vercel prod.**

1. **Open a PR and merge to `main`** (or push directly if that is your process).

   Optional local gate before merge:

   ```bash
   pnpm install
   pnpm run check && pnpm run lint && pnpm run preflight
   ```

   Requires `VITE_CONVEX_URL` in environment (or `.env.local`).

2. **Watch the CI workflow** (`.github/workflows/ci.yml`) on `main`:

   1. `preflight` — format, lint, test + build
   2. `Deploy Convex (production)` — `npx convex deploy` via `CONVEX_DEPLOY_KEY`
   3. `Deploy Vercel (production)` — `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod`

   If Convex succeeds and Vercel fails, leave the backend ahead; fix the frontend job and re-run / re-push. Do **not** roll Convex back automatically.

   Optional Playwright `e2e` does **not** gate production deploy.

3. **Schema backfills (manual, when a change needs them)**

   Actions does **not** run one-shot backfills. After the Convex deploy that introduces a schema/data migration, run the relevant command once per environment (usually with a local CLI pointed at that deployment):

   After deploying schema with `itemAssignments.billId`:

   ```bash
   npx convex run backfill:assignmentBillIds
   ```

   After deploying share-token schema:

   ```bash
   npx convex run backfill:shareTokens
   ```

   After deploying Area B money-correctness changes (optional, idempotent):

   ```bash
   npx convex run backfill:normalizeAssignmentModes
   ```

   After deploying Area E list-summary fields (required once per environment):

   ```bash
   npx convex run backfill:refreshBillListSummaries
   ```

   After deploying Area E assignment compound index (optional, idempotent):

   ```bash
   npx convex run backfill:dedupeAssignments
   ```

4. **Emergency / local-only Convex deploy**

   Prefer the Actions path. Use a manual deploy only when CI cannot (dashboard outage workaround, break-glass):

   ```bash
   pnpm run deploy
   # or: npx convex deploy
   ```

   Prefer a production `CONVEX_DEPLOY_KEY` in the environment, or ensure `CONVEX_DEPLOYMENT` in `.env.local` is understood: `npx convex deploy` still targets the project’s **production** deployment after confirmation. Do not leave production frontend releases to Vercel Git on `main`.

5. **Smoke test** (production URL)

   - [ ] GitHub Actions: all three production jobs green for the merge commit
   - [ ] Home loads; bills list appears
   - [ ] Sign in (Google + magic link)
   - [ ] Create bill → add participant → add item → assign
   - [ ] QR invite / share link opens guest join flow
   - [ ] Guest can claim items; second device sees name as „Заето“
   - [ ] Summary page; finalize with restaurant name
   - [ ] Finalized bill: guest claim page is read-only
   - [ ] Mark participant paid
   - [ ] Payment settings (Revolut/IBAN) persist after reload
   - [ ] Receipt OCR scan (if Gemini key set)
   - [ ] Add to Home Screen shows branded icon
   - [ ] Browser tab shows favicon
   - [ ] Service worker registered (DevTools → Application → Service Workers)
   - [ ] No devtools panel visible
   - [ ] Summary bottom buttons not clipped on mobile
   - [ ] 404 page on unknown routes
   - [ ] Network tab: `getForGuest` response has `myPayments`, not `payments`
   - [ ] Convex dashboard: `assignments.toggle` without `sessionToken` on guest bill → throws

## Domain cutover (custom domain)

Do this **after** smoke tests pass on `https://<project>.vercel.app`.

### Phase 1 — Verify on Vercel subdomain

1. Deploy to Vercel without attaching custom domain.
2. Smoke test all critical flows on `*.vercel.app`.

### Phase 2 — Attach `onova-za-smetkata.com`

1. Vercel project → **Settings → Domains** → add `onova-za-smetkata.com` and `www.onova-za-smetkata.com`.
2. In Vercel DNS, remove records pointing to Netlify (if present):
   - Delete **A** `@` → Netlify IP
   - Delete **CNAME** `www` → `*.netlify.app`
3. Let Vercel manage apex ALIAS records for the assigned project.
4. Wait for SSL provisioning.
5. Convex prod: `SITE_URL=https://onova-za-smetkata.com`
6. Vercel: `VITE_APP_ORIGIN=https://onova-za-smetkata.com` → redeploy.
7. Re-run smoke tests on `https://onova-za-smetkata.com`.

### Phase 3 — Decommission Netlify

1. Remove custom domains from Netlify site.
2. Disable Netlify deploys or delete the site.
3. Remove Netlify environment variables.

## Troubleshooting

| Symptom                                              | Likely cause                                | Fix                                                                                         |
| ---------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Frontend live, Convex API/schema errors              | Old failure mode: UI shipped without Convex | Use Actions order; do not re-enable Git prod deploys on `main`                              |
| Actions: Convex deploy fails                         | Missing/wrong `CONVEX_DEPLOY_KEY`           | Mint production deploy key with `deployment:deploy`; update secret                          |
| Actions: Vercel deploy fails after Convex green      | Vercel secrets/env; CLI build error         | Fix `VERCEL_*` / dashboard env; re-run failed job or re-push (backend may already be ahead) |
| Push to `main` deploys Vercel with no Actions        | Git auto-deploy still on for `main`         | Ensure `vercel.json` `git.deploymentEnabled.main: false` is on the branch Vercel reads      |
| Blank page / config message                          | Missing `VITE_CONVEX_URL` on Vercel         | Set env var; redeploy via Actions                                                           |
| Build fails on Vercel (`ERR_PNPM_OUTDATED_LOCKFILE`) | `pnpm-lock.yaml` out of sync                | Run `pnpm install` locally; commit lockfile                                                 |
| Build fails on Vercel (other)                        | Missing `VITE_CONVEX_URL`                   | Set in Vercel Production env (pulled by CLI)                                                |
| Apex domain `DEPLOYMENT_NOT_FOUND`                   | Domain not assigned to Vercel project       | Add domain in Vercel project settings                                                       |
| Preflight fails on PWA icons                         | PNGs not generated                          | Run `pnpm run generate-icons` and commit                                                    |
| Google sign-in `redirect_uri_mismatch`               | Wrong callback in Google Console            | Add prod `*.convex.site/api/auth/callback/google`                                           |
| Magic link / `auth:signIn` fails in prod             | Auth env only on dev deployment             | Set `SITE_URL`, JWT keys, Resend key on **prod** Convex                                     |
| OCR always fails                                     | Missing `GEMINI_API_KEY` in Convex prod     | Set in Convex Dashboard                                                                     |
| Data from wrong environment                          | Dev Convex URL in Vercel                    | Point Vercel at prod URL                                                                    |
| Guest assignment fails                               | Missing/expired session                     | Re-join and pick name again                                                                 |
| Assignment queries fail after upgrade                | Missing `billId` backfill                   | Run `npx convex run backfill:assignmentBillIds`                                             |

## Production launch checklist

Complete once before calling production “solid”:

| Item                                          | Where             | Notes                                                                     |
| --------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| `VITE_CONVEX_URL`                             | Vercel            | Prod Convex cloud URL                                                     |
| `VITE_APP_ORIGIN`                             | Vercel            | `https://onova-za-smetkata.com` for OG/QR                                 |
| `SITE_URL`                                    | Convex prod       | Same custom domain for magic links                                        |
| `AUTH_RESEND_FROM`                            | Convex prod       | Verified domain, e.g. `Онова за сметката <noreply@onova-za-smetkata.com>` |
| `AUTH_RESEND_KEY`, JWT, Google OAuth          | Convex prod       | Dashboard → Settings → Environment                                        |
| `GEMINI_API_KEY`                              | Convex prod       | Receipt OCR                                                               |
| `DEV_MODE`                                    | Convex prod       | Must **not** be `true`                                                    |
| Backfill                                      | Convex prod       | Manual when needed (see release steps); not automated in Actions          |
| Domain + SSL                                  | Vercel            | Custom domain active                                                      |
| Netlify decommissioned                        | Netlify           | No stale DNS to old host                                                  |
| GitHub Actions secrets                        | GitHub            | `CONVEX_DEPLOY_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| `vercel.json` disables `main` Git prod deploy | Repo              | Production only via Actions after Convex                                  |
| Smoke test                                    | Production URL    | See release steps above                                                   |
| Link preview                                  | WhatsApp/Telegram | Join URL shows OG image                                                   |
| Optional Sentry                               | Vercel            | `VITE_SENTRY_DSN`                                                         |

### E2E in CI (optional)

To run Playwright on push/PR, add GitHub secret `E2E_VITE_CONVEX_URL` pointing at a **dev** Convex deployment with `DEV_MODE=true`. The CI job is skipped when the secret is unset. Optional e2e does **not** block the Convex → Vercel production jobs.
