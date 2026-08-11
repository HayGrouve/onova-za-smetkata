# Deploy Runbook

## Prerequisites (one-time)

- [ ] GitHub repo connected to Vercel (PR previews OK; **production** deploys are owned by GitHub Actions)
- [ ] Convex **production** deployment exists
- [ ] Vercel env: `VITE_CONVEX_URL` = prod Convex cloud URL
- [ ] Convex prod env: `GEMINI_API_KEY` (for receipt OCR)
- [ ] Clerk production instance configured per `docs/clerk-production-setup.md` (Google SSO, email sign-in, Billing, webhooks)
- [ ] Optional: `VITE_SENTRY_DSN` on Vercel for client error tracking
- [ ] GitHub Actions secrets for production release (see below)
- [ ] `vercel.json` in repo sets `git.deploymentEnabled.main: false` so a push to `main` does **not** auto-deploy production on Vercel

## Environment variables

| Variable                       | Where                           | Required                                                              |
| ------------------------------ | ------------------------------- | --------------------------------------------------------------------- |
| `VITE_CONVEX_URL`              | Vercel                          | Yes                                                                   |
| `VITE_APP_ORIGIN`              | Vercel                          | Yes for production OG/share URLs (`https://onova-za-smetkata.com`)    |
| `VITE_SENTRY_DSN`              | Vercel                          | No (Sentry client errors in production)                               |
| `GEMINI_API_KEY`               | Convex Dashboard                | Yes (for OCR)                                                         |
| `GEMINI_MODEL`                 | Convex Dashboard                | No                                                                    |
| `CLERK_JWT_ISSUER_DOMAIN`      | Convex Dashboard (dev + prod)   | Yes (Clerk JWT validation)                                            |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Convex Dashboard                | Yes (Billing webhooks at `/clerk/webhook`)                            |
| `VITE_CLERK_PUBLISHABLE_KEY`   | Vercel / `.env.local`           | Yes (Clerk client — **Vite** prefix, not `NEXT_PUBLIC_*`)             |
| `CLERK_PUBLISHABLE_KEY`        | Vercel / `.env.local`           | Recommended (same `pk_live_…`; SSR middleware fallback)               |
| `CLERK_SECRET_KEY`             | Vercel / `.env.local`           | Yes (TanStack Start `clerkMiddleware`)                                |
| `DEV_MODE`                     | Convex Dashboard (**dev only**) | No — dev-only mutations (e.g. onboarding reset); **never production** |
| `CONVEX_DEPLOYMENT`            | Local `.env.local`              | Yes for local `npx convex` CLI                                        |
| `CONVEX_DEPLOY_KEY`            | GitHub Actions secret           | Yes — production deploy key (`deployment:deploy`)                     |
| `VERCEL_TOKEN`                 | GitHub Actions secret           | Yes — Vercel access token for CLI deploys                             |
| `VERCEL_ORG_ID`                | GitHub Actions secret           | Yes                                                                   |
| `VERCEL_PROJECT_ID`            | GitHub Actions secret           | Yes                                                                   |

Never put `GEMINI_API_KEY`, Clerk secrets, `DEV_MODE`, or deploy keys/tokens in the repo.

### Security notes

- **Share tokens:** Guest join links require `?t={shareToken}` (e.g. `/bills/{id}/join?t=...`). The token is rotatable from the host invite card (“Обнови линка”). After deploying the share-token schema, run `npx convex run backfill:shareTokens` on each environment once.
- **Capability URLs:** Share join links only with people at the table. Rotating the token invalidates leaked links.
- **Guest sessions:** Assignment mutations require a valid guest session token or host auth. Expired sessions must re-claim a name on the join page.
- **Guest payment privacy:** `getForGuest` returns `myPayments` only — never the full payments list.
- **DEV_MODE:** Enables dev-only mutations (e.g. onboarding reset) only when `DEV_MODE=true` on an **explicit dev deployment allowlist** (`striped-shepherd-984` plus optional `CONVEX_DEV_DEPLOYMENTS`). Never set `DEV_MODE=true` on production. Host E2E auth uses **Clerk Testing Tokens**, not `DEV_MODE`.
- **Guest identity risk:** Guest names are claimable without accounts; if a session expires (~90s without heartbeat), another device can claim the same name. Document as accepted product risk for accountless guests.
- **Rate limits:** Guest claims are limited per actor and per bill; assignment toggles, heartbeats, releases, and receipt uploads are rate-limited server-side.
- **Cleanup cron:** `cleanup.run` purges expired guest sessions, stale rate-limit buckets, and old terminal receipt scans every 6 hours (registered in `convex/crons.ts`).

### Clerk (production)

1. Create a Clerk **production** instance separate from dev.
2. Enable Google + Email sign-in; Bulgarian Clerk UI via `ClerkProvider localization={bgBG}` in app code (not a dashboard setting).
3. Create JWT template **`convex`** with `applicationID: convex`.
4. Enable Billing → Plans: keep `free_user`, add **`pro`** at €2.99/month EUR.
5. Set on **production** Convex: `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SIGNING_SECRET`.
6. Register webhook URL: `https://<prod-deployment>.convex.site/clerk/webhook`.
7. Set on Vercel: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (optional duplicate: `CLERK_PUBLISHABLE_KEY`). **Do not** use `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — this stack is Vite, not Next.js.

See ADR 0002 in `docs/adr/`. Full Clerk + Google OAuth steps: **`docs/clerk-production-setup.md`** (prod auth verified 2026-08-11).

### Sentry

1. Create a Sentry project (React).
2. Set `VITE_SENTRY_DSN` on Vercel.
3. After deploy, trigger a test error and confirm it appears in Sentry.

## Vercel project setup

1. Import the GitHub repo in [Vercel](https://vercel.com).
2. Framework: TanStack Start (auto-detected with Nitro plugin).
3. Package manager: pnpm.
4. Node.js: 22 (set in project settings if needed).
5. Environment variables (Production) — used by `vercel pull` / `vercel build` in Actions:
   - `VITE_CONVEX_URL=https://coordinated-warbler-782.convex.cloud`
   - `VITE_APP_ORIGIN=https://onova-za-smetkata.com` (required for correct OG previews)
   - Optional: `VITE_SENTRY_DSN`
   - `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (Clerk prod; optional `CLERK_PUBLISHABLE_KEY` duplicate)
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
   - [ ] Sign in (Google + email via Clerk)
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
   - [ ] Convex dashboard: `assignments.joinUnit` without `sessionToken` on guest bill → throws (unless bill owner)

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
5. Vercel: `VITE_APP_ORIGIN=https://onova-za-smetkata.com` → redeploy.
6. Re-run smoke tests on `https://onova-za-smetkata.com`.

### Phase 3 — Decommission Netlify

1. Remove custom domains from Netlify site.
2. Disable Netlify deploys or delete the site.
3. Remove Netlify environment variables.

## Troubleshooting

| Symptom                                              | Likely cause                                | Fix                                                                                              |
| ---------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Frontend live, Convex API/schema errors              | Old failure mode: UI shipped without Convex | Use Actions order; do not re-enable Git prod deploys on `main`                                   |
| Actions: Convex deploy fails                         | Missing/wrong `CONVEX_DEPLOY_KEY`           | Mint production deploy key with `deployment:deploy`; update secret                               |
| Actions: Vercel deploy fails after Convex green      | Vercel secrets/env; CLI build error         | Fix `VERCEL_*` / dashboard env; re-run failed job or re-push (backend may already be ahead)      |
| Push to `main` deploys Vercel with no Actions        | Git auto-deploy still on for `main`         | Ensure `vercel.json` `git.deploymentEnabled.main: false` is on the branch Vercel reads           |
| Blank page / config message                          | Missing `VITE_CONVEX_URL` on Vercel         | Set env var; redeploy via Actions                                                                |
| Build fails on Vercel (`ERR_PNPM_OUTDATED_LOCKFILE`) | `pnpm-lock.yaml` out of sync                | Run `pnpm install` locally; commit lockfile                                                      |
| Build fails on Vercel (other)                        | Missing `VITE_CONVEX_URL`                   | Set in Vercel Production env (pulled by CLI)                                                     |
| Apex domain `DEPLOYMENT_NOT_FOUND`                   | Domain not assigned to Vercel project       | Add domain in Vercel project settings                                                            |
| Preflight fails on PWA icons                         | PNGs not generated                          | Run `pnpm run generate-icons` and commit                                                         |
| Google sign-in `redirect_uri_mismatch`               | Wrong callback in Google Console            | Use Clerk redirect URI per `docs/clerk-production-setup.md` §1.8                                 |
| Clerk sign-in fails / blank auth UI                  | Missing or wrong Clerk keys on Vercel       | Set `VITE_CLERK_PUBLISHABLE_KEY` (not `NEXT_PUBLIC_*`); `CLERK_SECRET_KEY`; redeploy via Actions |
| Vercel 500: Publishable key is missing               | `NEXT_PUBLIC_*` or key removed              | Restore `VITE_CLERK_PUBLISHABLE_KEY`; see `docs/clerk-production-setup.md` §4                    |
| Login page text only; `https://npm/@clerk/clerk-js`  | Bad `CLERK_JS_URL` or FAPI DNS on `clerk.`  | Remove `CLERK_JS_*` vars; fix Clerk custom-domain CNAME; redeploy                                |
| Convex rejects host mutations                        | JWT issuer mismatch                         | Set `CLERK_JWT_ISSUER_DOMAIN` = `https://clerk.onova-za-smetkata.com` on Convex prod             |
| OCR always fails                                     | Missing `GEMINI_API_KEY` in Convex prod     | Set in Convex Dashboard                                                                          |
| Data from wrong environment                          | Dev Convex URL in Vercel                    | Point Vercel at prod URL                                                                         |
| Guest assignment fails                               | Missing/expired session                     | Re-join and pick name again                                                                      |
| Assignment queries fail after upgrade                | Missing `billId` backfill                   | Run `npx convex run backfill:assignmentBillIds`                                                  |

## Production launch checklist

Complete once before calling production “solid”:

| Item                                             | Where             | Notes                                                                     |
| ------------------------------------------------ | ----------------- | ------------------------------------------------------------------------- |
| `VITE_CONVEX_URL`                                | Vercel            | Prod Convex cloud URL                                                     |
| `VITE_APP_ORIGIN`                                | Vercel            | `https://onova-za-smetkata.com` for OG/QR                                 |
| `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Vercel            | Clerk production instance (auth verified 2026-08-11)                      |
| `CLERK_JWT_ISSUER_DOMAIN`                        | Convex prod       | `https://clerk.onova-za-smetkata.com`                                     |
| `CLERK_WEBHOOK_SIGNING_SECRET`                   | Convex prod       | Billing webhook at `/clerk/webhook`                                       |
| Clerk webhook + Google SSO                       | Clerk Dashboard   | See `docs/clerk-production-setup.md`                                      |
| `GEMINI_API_KEY`                                 | Convex prod       | Receipt OCR                                                               |
| `DEV_MODE`                                       | Convex prod       | Must **not** be `true`                                                    |
| Backfill                                         | Convex prod       | Manual when needed (see release steps); not automated in Actions          |
| Domain + SSL                                     | Vercel            | Custom domain active                                                      |
| Netlify decommissioned                           | Netlify           | No stale DNS to old host                                                  |
| GitHub Actions secrets                           | GitHub            | `CONVEX_DEPLOY_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` |
| `vercel.json` disables `main` Git prod deploy    | Repo              | Production only via Actions after Convex                                  |
| Smoke test                                       | Production URL    | See release steps above                                                   |
| Link preview                                     | WhatsApp/Telegram | Join URL shows OG image                                                   |
| Optional Sentry                                  | Vercel            | `VITE_SENTRY_DSN`                                                         |

### E2E in CI (optional)

To run Playwright on push/PR, add GitHub secret `E2E_VITE_CONVEX_URL` pointing at a **dev** Convex deployment with `DEV_MODE=true`. The CI job is skipped when the secret is unset. Optional e2e does **not** block the Convex → Vercel production jobs.
