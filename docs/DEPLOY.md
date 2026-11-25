# Deploy Runbook

## Prerequisites (one-time)

- [ ] GitHub repo connected to Vercel (PR previews OK; **production** deploys are owned by GitHub Actions)
- [ ] Convex **production** deployment exists
- [ ] Vercel env: Production `VITE_CONVEX_URL` = prod Convex cloud URL; Preview and Development = dev (see [Environment variables](#environment-variables))
- [ ] Convex prod env: `GEMINI_API_KEY` (for receipt OCR)
- [ ] The shared Акаунт's production Clerk app "онова за" (`clerk.onovaza.com`) is live per the hub's checklist (HayGrouve/onova-za#26), and the hub marks Сметката as an Акаунт project (HayGrouve/onova-za#65), so `https://onovaza.com/vhod` accepts `smetkata.onovaza.com` as a return address
- [ ] Host Pro billing stays **off** until `BILLING_ENABLED=true` on Convex — see [Host Pro billing (Stripe Managed Payments)](#host-pro-billing-stripe-managed-payments) and [ADR 0004](./adr/0004-stripe-managed-payments.md)
- [ ] GitHub Actions secrets for production release (see below)
- [ ] `vercel.json` in repo sets `git.deploymentEnabled.main: false` so a push to `main` does **not** auto-deploy production on Vercel

## Environment variables

Host sign-in runs on the shared Акаунт, the Clerk app "онова за" ([ADR 0005](./adr/0005-sign-in-and-akaunt-on-the-hub.md)). Its **production** instance (`https://clerk.onovaza.com`) serves `https://smetkata.onovaza.com` with Convex prod `coordinated-warbler-782`; sign-in happens on `https://onovaza.com/vhod`. Its **development** instance (Frontend API `https://fancy-bobcat-6703.clerk.accounts.dev`) serves local dev, Vercel Preview and Development, and CI e2e, all against the dev Convex deployment `striped-shepherd-984`, with sign-in on the dev Account Portal. The one-time move of production is in [Moving production to the shared Акаунт](#moving-production-to-the-shared-акаунт-one-time).

### Which value lives where

| Variable                                           | Production (Vercel)                            | Preview and Development (Vercel), `.env.local`                 |
| -------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| `VITE_CONVEX_URL`                                  | `https://coordinated-warbler-782.convex.cloud` | `https://striped-shepherd-984.convex.cloud`                    |
| `VITE_CLERK_PUBLISHABLE_KEY`                       | "онова за" production `pk_live_…`              | "онова за" dev `pk_test_…`                                     |
| `CLERK_SECRET_KEY`                                 | the `smetkata` `sk_live_…` key (Sensitive)     | "онова за" dev `sk_test_…`                                     |
| `VITE_APP_ORIGIN`                                  | `https://smetkata.onovaza.com`                 | **unset**: share links and canonical use the page's own origin |
| `VITE_CLERK_SIGN_IN_URL`, `VITE_CLERK_SIGN_UP_URL` | `https://onovaza.com/vhod`                     | **unset**: Clerk falls back to the dev Account Portal          |
| `CLERK_AUTHORIZED_PARTIES` (server only)           | `https://smetkata.onovaza.com`                 | **unset**: SSR skips the `azp` check                           |

Each of these is a separate Vercel entry per environment: never widen a Production entry to Preview again (live Clerk keys do not work on `*.vercel.app`, and production Convex will trust only `clerk.onovaza.com`). Never set a relative sign-in URL (`/login`) in Preview or Development: once `/login` only bounces to the sign-in URL it would redirect to itself. `VITE_` values are inlined at build time, so a change needs a new build.

Previews run against **whatever functions sit on dev Convex**, not the PR's `convex/`. A PR that changes `convex/` is pushed to dev with `npx convex dev --once` before its preview (or its CI e2e) is trusted, and two such PRs at once overwrite each other there.

| Variable                       | Convex prod `coordinated-warbler-782`                          | Convex dev `striped-shepherd-984`                                                                                  |
| ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `CLERK_JWT_ISSUER_DOMAIN`      | `https://clerk.onovaza.com`                                    | `https://fancy-bobcat-6703.clerk.accounts.dev`                                                                     |
| `CLERK_WEBHOOK_SIGNING_SECRET` | `whsec_…` of the prod `user.deleted` endpoint                  | `whsec_…` of the dev instance's `user.deleted` endpoint (`https://striped-shepherd-984.convex.site/clerk/webhook`) |
| `CLERK_AUTHORIZED_PARTIES`     | `https://smetkata.onovaza.com` (after the `azp` decode passed) | unset                                                                                                              |
| `DEV_MODE`                     | **never**                                                      | `true` (dev-only mutations)                                                                                        |
| `GEMINI_API_KEY`               | yes                                                            | yes                                                                                                                |

| GitHub Actions secret            | Value                                                                 |
| -------------------------------- | --------------------------------------------------------------------- |
| `E2E_VITE_CONVEX_URL`            | `https://striped-shepherd-984.convex.cloud` (unset skips the e2e job) |
| `E2E_VITE_CLERK_PUBLISHABLE_KEY` | "онова за" dev `pk_test_…`                                            |
| `E2E_CLERK_SECRET_KEY`           | "онова за" dev `sk_test_…` (Clerk Testing Tokens)                     |
| `E2E_CLERK_USER_EMAIL`           | `smetkata+clerk_test@example.com`, a test user in that dev instance   |
| `CONVEX_DEPLOY_KEY`, `VERCEL_*`  | production deploy (below)                                             |

Get the dev Clerk keys with `clerk env pull --app app_3Lk5Y1X31WAloPBVBUnYrtoTplv --instance dev --print` and pipe them where they go; never paste them into chat, an issue or a commit.

### All variables

| Variable                       | Where                           | Required                                                                 |
| ------------------------------ | ------------------------------- | ------------------------------------------------------------------------ |
| `VITE_CONVEX_URL`              | Vercel / `.env.local`           | Yes                                                                      |
| `VITE_APP_ORIGIN`              | Vercel (Production only)        | Production only, for OG/share URLs; unset everywhere else                |
| `VITE_CLERK_SIGN_IN_URL`       | Vercel (Production only)        | Production only: `https://onovaza.com/vhod`; never a relative URL        |
| `VITE_CLERK_SIGN_UP_URL`       | Vercel (Production only)        | Production only: `https://onovaza.com/vhod`; never a relative URL        |
| `GEMINI_API_KEY`               | Convex Dashboard                | Yes (for OCR)                                                            |
| `GEMINI_MODEL`                 | Convex Dashboard                | No                                                                       |
| `CLERK_JWT_ISSUER_DOMAIN`      | Convex Dashboard (dev + prod)   | Yes (Clerk JWT validation)                                               |
| `CLERK_AUTHORIZED_PARTIES`     | Vercel (Production only)        | Production: SSR `authorizedParties` (`src/start.ts`), read per request   |
| `CLERK_AUTHORIZED_PARTIES`     | Convex Dashboard (prod)         | No: origins allowed as the token's `azp`, comma separated; unset = off   |
| `VITE_CLERK_PUBLISHABLE_KEY`   | Vercel / `.env.local`           | Yes (Clerk client; **Vite** prefix, not `NEXT_PUBLIC_*`)                 |
| `CLERK_SECRET_KEY`             | Vercel / `.env.local`           | Yes (TanStack Start `clerkMiddleware`)                                   |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Convex Dashboard (dev + prod)   | Yes: `whsec_…` of the Clerk `/clerk/webhook` endpoint (account deletion) |
| `DEV_MODE`                     | Convex Dashboard (**dev only**) | No: dev-only mutations (e.g. onboarding reset); **never production**     |
| `BILLING_ENABLED`              | Convex Dashboard                | No: `true` turns Host Pro billing on; unset = everyone free              |
| `STRIPE_SECRET_KEY`            | Convex Dashboard                | When billing is on (restricted key recommended)                          |
| `STRIPE_WEBHOOK_SECRET`        | Convex Dashboard                | When billing is on (`whsec_…` of the `/stripe/webhook` endpoint)         |
| `STRIPE_PRICE_MONTHLY`         | Convex Dashboard                | When billing is on (`price_…`, €2.99/month, VAT-inclusive)               |
| `STRIPE_PRICE_YEARLY`          | Convex Dashboard                | When billing is on (`price_…`, €29/year, VAT-inclusive)                  |
| `APP_ORIGIN`                   | Convex Dashboard                | When billing is on (Checkout/Portal return URL origin)                   |
| `CONVEX_DEPLOYMENT`            | Local `.env.local`              | Yes for local `npx convex` CLI (`dev:striped-shepherd-984`)              |
| `CONVEX_DEPLOY_KEY`            | GitHub Actions secret           | Yes: production deploy key (`deployment:deploy`)                         |
| `VERCEL_TOKEN`                 | GitHub Actions secret           | Yes: Vercel access token for CLI deploys                                 |
| `VERCEL_ORG_ID`                | GitHub Actions secret           | Yes                                                                      |
| `VERCEL_PROJECT_ID`            | GitHub Actions secret           | Yes                                                                      |

On Convex prod, `CLERK_AUTHORIZED_PARTIES` is set only after the cutover's `azp` decode passed (HayGrouve/onova-za-smetkata#212, step 3.1). Once it is set, the Convex dashboard's "run as user" needs `"azp": "https://smetkata.onovaza.com"` in the identity JSON, or the function sees a signed out caller.

Never put `GEMINI_API_KEY`, Stripe keys, Clerk secrets, `DEV_MODE`, or deploy keys/tokens in the repo.

### Host Pro billing (Stripe Managed Payments)

Billing is off until `BILLING_ENABLED=true`; until then every Host has Pro limits and no billing UI is shown. To turn it on for an environment ([ADR 0004](./adr/0004-stripe-managed-payments.md)):

1. Stripe Dashboard → **Settings → Managed Payments**: pass the eligibility review and accept the Managed Payments terms.
2. **Tax settings → Include tax in prices** (or `tax_behavior: inclusive` on each price), so €2.99 / €29 are what customers pay.
3. Create one product „Онова за сметката Pro“ with tax code `txcd_10103000` (SaaS, personal use) and two EUR prices: €2.99 monthly and €29 yearly.
4. **Customer Portal** settings: allow cancel at period end, switching between the two prices, payment-method updates and invoice history; set the Bulgarian business details.
5. **Webhooks**: endpoint `https://<deployment>.convex.site/stripe/webhook` with events `checkout.session.completed`, `customer.subscription.created|updated|deleted|paused|resumed`, `invoice.paid`, `invoice.payment_failed`.
6. Set the Convex env vars above (`npx convex env set …`, or `--prod`), then `BILLING_ENABLED=true` last.

Local testing: use a Stripe sandbox and `stripe listen --forward-to https://<dev-deployment>.convex.site/stripe/webhook` (the dev deployment URL is public), with `APP_ORIGIN=http://localhost:3000`.

### Security notes

- **Share tokens:** Guest join links require `?t={shareToken}` (e.g. `/bills/{id}/join?t=...`). The token is rotatable from the host invite card (“Обнови линка”). After deploying the share-token schema, run `npx convex run backfill:shareTokens` on each environment once.
- **Capability URLs:** Share join links only with people at the table. Rotating the token invalidates leaked links.
- **Guest sessions:** Assignment mutations require a valid guest session token or host auth. Expired sessions must re-claim a name on the join page.
- **Guest payment privacy:** `getForGuest` returns `myPayments` only — never the full payments list.
- **DEV_MODE:** Enables dev-only mutations (e.g. onboarding reset) only when `DEV_MODE=true` on an **explicit dev deployment allowlist** (`striped-shepherd-984` plus optional `CONVEX_DEV_DEPLOYMENTS`). Never set `DEV_MODE=true` on production. Host E2E auth uses **Clerk Testing Tokens**, not `DEV_MODE`.
- **Guest identity risk:** Guest names are claimable without accounts; if a session expires (~90s without heartbeat), another device can claim the same name. Document as accepted product risk for accountless guests.
- **Rate limits:** Guest claims are limited per actor and per bill; assignment toggles, heartbeats, releases, and receipt uploads are rate-limited server-side.
- **Cleanup cron:** `cleanup.run` purges expired guest sessions, stale rate-limit buckets, and old terminal receipt scans every 6 hours (registered in `convex/crons.ts`).

### Clerk (production): the shared Акаунт

The Clerk app "онова за" belongs to the hub (HayGrouve/onova-za#26 has its checklist: domain, Google, email code, Convex integration claims, the subdomain allowlist). Сметката renders no Clerk screen ([ADR 0005](./adr/0005-sign-in-and-akaunt-on-the-hub.md)); what it owns there:

1. Its own secret key, named `smetkata`, in Vercel **Production** `CLERK_SECRET_KEY` (Sensitive). Never paste it anywhere else.
2. The `user.deleted` webhook: endpoint `https://coordinated-warbler-782.convex.site/clerk/webhook`, that event only. Its signing secret goes to Convex prod with `npx convex env set --prod CLERK_WEBHOOK_SIGNING_SECRET` (typed at the prompt). Send a test `user.deleted` from the endpoint's Testing tab; it should answer 200. When a Host deletes their Акаунт, `accountDeletion.deleteHostData` erases their bills, seats, payments, payment settings, groups, counters and receipt photos, and cancels a live Stripe subscription. Until the secret is set the endpoint answers 503 and Clerk retries.
3. Convex prod `CLERK_JWT_ISSUER_DOMAIN=https://clerk.onovaza.com`.
4. **Do not** enable Clerk Billing. Host Pro is Stripe ([ADR 0004](./adr/0004-stripe-managed-payments.md)). **Do not** use `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: this stack is Vite.

### Moving production to the shared Акаунт (one time)

Runbook with every check: HayGrouve/onova-za-smetkata#212. The order matters because merging to `main` deploys production, and `VITE_` values are inlined at build time, so the Production env must be complete before the cutover merge builds:

1. Vercel **Production**: `VITE_CLERK_PUBLISHABLE_KEY` (the "онова за" `pk_live_`), `VITE_CLERK_SIGN_IN_URL` and `VITE_CLERK_SIGN_UP_URL` (`https://onovaza.com/vhod`), `CLERK_AUTHORIZED_PARTIES` and `VITE_APP_ORIGIN` (`https://smetkata.onovaza.com`); the owner creates the `smetkata` secret key and enters it as `CLERK_SECRET_KEY`. Preview and Development stay untouched.
2. The `user.deleted` webhook and its secret on Convex prod (above).
3. Convex prod `CLERK_JWT_ISSUER_DOMAIN=https://clerk.onovaza.com`, then merge the cutover PR; CI deploys Convex, then Vercel.
4. After the `azp` decode passed: Convex prod `CLERK_AUTHORIZED_PARTIES=https://smetkata.onovaza.com`.

### Stripe (Host Pro)

When Host Pro ships: Stripe Product/Price in **EUR**, Checkout + Customer Portal, webhook to Convex (not Clerk). Quota enforcement stays in `convex/lib/hostTier.ts`. Guest Revolut/IBAN is unrelated.

## Vercel project setup

1. Import the GitHub repo in [Vercel](https://vercel.com).
2. Framework: TanStack Start (auto-detected with Nitro plugin).
3. Package manager: pnpm.
4. Node.js: 22 (set in project settings if needed).
5. Environment variables, one entry per environment as in [Which value lives where](#which-value-lives-where). Production is pulled by `vercel pull --environment=production` / `vercel build` in Actions; Preview is what Vercel's Git integration builds PR previews with; Development is what `vercel env pull` writes locally.
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

   After deploying Area E list-summary fields, and again after the home collection fields (`listCollectedCents`, `listGuestBalances`, `listPrepared`, …) — required once per environment; `bills.homeOverview` recomputes old drafts on the fly until then:

   ```bash
   npx convex run backfill:refreshBillListSummaries
   ```

   After deploying Area E assignment compound index (optional, idempotent):

   ```bash
   npx convex run backfill:dedupeAssignments
   ```

   After deploying `users.plan` (replaces the Clerk Billing-era `clerkPlanSlug`) — required once per environment before `clerkPlanSlug` is dropped from the schema; idempotent:

   ```bash
   npx convex run backfill:planFromClerkPlanSlug
   ```

   After deploying `guestSessionPresence` (Guest heartbeats moved off `guestSessions`) — run once per environment right after the deploy; idempotent. Until then the minute sweep still ends old sessions, it just keeps reading them:

   ```bash
   npx convex run backfill:guestSessionPresence
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
   - [ ] Вход goes to `https://onovaza.com/vhod?redirect_url=…`, names Сметката, and returns to the same page
   - [ ] Avatar menu shows only „Акаунт“ (to `https://onovaza.com/akaunt`) and „Изход“; Изход lands on `/`
   - [ ] `/privacy`, `/terms` answer 308 to the hub anchors (`#smetkata`); `/user-profile/*` to `/abonament` with the query
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
   - [ ] Unknown routes show the 404 page and answer HTTP **404** (`curl -sI https://smetkata.onovaza.com/nope`)
   - [ ] A new share link names `https://smetkata.onovaza.com`
   - [ ] Browser console: no CSP violations for Clerk (the report-only CSP has no report endpoint)
   - [ ] Network tab: `getForGuest` response has `myPayments`, not `payments`
   - [ ] Convex dashboard: `assignments.joinUnit` without `sessionToken` on guest bill → throws (unless bill owner)

## Domains

`https://smetkata.onovaza.com` is the production domain (canonical, share links, `sitemap.xml`, `robots.txt`); `onovaza.com/smetkata` 308s there from the hub. The old addresses redirect to it with path and query: `onova-za-smetkata.com` and `www.onova-za-smetkata.com` as Vercel domain redirects (308), `onova-za-smetkata.vercel.app` by a project routing rule (HayGrouve/onova-za-smetkata#212, step 2.8). onova-za-smetkata.com is not renewed and lapses on 2027-07-08.

## Troubleshooting

| Symptom                                              | Likely cause                                         | Fix                                                                                              |
| ---------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Frontend live, Convex API/schema errors              | Old failure mode: UI shipped without Convex          | Use Actions order; do not re-enable Git prod deploys on `main`                                   |
| Actions: Convex deploy fails                         | Missing/wrong `CONVEX_DEPLOY_KEY`                    | Mint production deploy key with `deployment:deploy`; update secret                               |
| Actions: Vercel deploy fails after Convex green      | Vercel secrets/env; CLI build error                  | Fix `VERCEL_*` / dashboard env; re-run failed job or re-push (backend may already be ahead)      |
| Push to `main` deploys Vercel with no Actions        | Git auto-deploy still on for `main`                  | Ensure `vercel.json` `git.deploymentEnabled.main: false` is on the branch Vercel reads           |
| Blank page / config message                          | Missing `VITE_CONVEX_URL` on Vercel                  | Set env var; redeploy via Actions                                                                |
| Build fails on Vercel (`ERR_PNPM_OUTDATED_LOCKFILE`) | `pnpm-lock.yaml` out of sync                         | Run `pnpm install` locally; commit lockfile                                                      |
| Build fails on Vercel (other)                        | Missing `VITE_CONVEX_URL`                            | Set in Vercel Production env (pulled by CLI)                                                     |
| Apex domain `DEPLOYMENT_NOT_FOUND`                   | Domain not assigned to Vercel project                | Add domain in Vercel project settings                                                            |
| Preflight fails on PWA icons                         | PNGs not generated                                   | Run `pnpm run generate-icons` and commit                                                         |
| Google sign-in fails on `/vhod`                      | Hub's Clerk app setup                                | HayGrouve/onova-za#26 (the Google client belongs to the "онова за" app)                          |
| `/vhod` refuses the return address                   | Hub does not mark Сметката as an Акаунт project yet  | HayGrouve/onova-za#65; the subdomain allowlist on the "онова за" app                             |
| Signed in on `/vhod`, signed out back here           | SSR `authorizedParties` mismatch                     | Vercel Production `CLERK_AUTHORIZED_PARTIES` = `https://smetkata.onovaza.com`, exactly           |
| Clerk sign-in fails / blank auth UI                  | Missing or wrong Clerk keys on Vercel                | Set `VITE_CLERK_PUBLISHABLE_KEY` (not `NEXT_PUBLIC_*`); `CLERK_SECRET_KEY`; redeploy via Actions |
| Vercel 500: Publishable key is missing               | `NEXT_PUBLIC_*` or key removed                       | Restore `VITE_CLERK_PUBLISHABLE_KEY`                                                             |
| Host pages stuck; `https://npm/@clerk/clerk-js`      | Bad `CLERK_JS_URL` or FAPI DNS on `clerk.`           | Remove `CLERK_JS_*` vars; fix Clerk custom-domain CNAME; redeploy                                |
| Convex rejects host mutations                        | JWT issuer mismatch                                  | Set `CLERK_JWT_ISSUER_DOMAIN` = `https://clerk.onovaza.com` on Convex prod                       |
| OCR always fails                                     | Missing `GEMINI_API_KEY` in Convex prod              | Set in Convex Dashboard                                                                          |
| Data from wrong environment                          | Dev Convex URL in Vercel Production                  | Production `VITE_CONVEX_URL` is the prod URL; only Preview/Development point at dev              |
| Preview: signed in but Convex calls signed out       | Host functions differ on dev Convex, or wrong issuer | `npx convex dev --once` from the PR branch; dev `CLERK_JWT_ISSUER_DOMAIN` = dev Frontend API URL |
| Guest assignment fails                               | Missing/expired session                              | Re-join and pick name again                                                                      |
| Assignment queries fail after upgrade                | Missing `billId` backfill                            | Run `npx convex run backfill:assignmentBillIds`                                                  |

## Production launch checklist

Complete once before calling production “solid”:

| Item                                             | Where             | Notes                                                                       |
| ------------------------------------------------ | ----------------- | --------------------------------------------------------------------------- |
| `VITE_CONVEX_URL`                                | Vercel            | Prod Convex cloud URL                                                       |
| `VITE_APP_ORIGIN`                                | Vercel            | `https://smetkata.onovaza.com` for OG/QR                                    |
| `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Vercel            | "онова за" production `pk_live_`, the `smetkata` secret key                 |
| `VITE_CLERK_SIGN_IN_URL`, `..._SIGN_UP_URL`      | Vercel            | `https://onovaza.com/vhod`                                                  |
| `CLERK_AUTHORIZED_PARTIES`                       | Vercel, Convex    | `https://smetkata.onovaza.com`                                              |
| `CLERK_JWT_ISSUER_DOMAIN`                        | Convex prod       | `https://clerk.onovaza.com`                                                 |
| Google SSO                                       | Hub's Clerk app   | HayGrouve/onova-za#26; **no Clerk Billing**                                 |
| Stripe Billing (Host Pro)                        | Stripe Dashboard  | When Host Pro ships — [ADR 0003](./adr/0003-stripe-billing-beside-clerk.md) |
| `GEMINI_API_KEY`                                 | Convex prod       | Receipt OCR                                                                 |
| Clerk `user.deleted` webhook                     | Clerk + Convex    | `/clerk/webhook` + `CLERK_WEBHOOK_SIGNING_SECRET` — erases deleted Hosts    |
| `DEV_MODE`                                       | Convex prod       | Must **not** be `true`                                                      |
| Backfill                                         | Convex prod       | Manual when needed (see release steps); not automated in Actions            |
| Domain + SSL                                     | Vercel            | Custom domain active                                                        |
| GitHub Actions secrets                           | GitHub            | `CONVEX_DEPLOY_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`   |
| `vercel.json` disables `main` Git prod deploy    | Repo              | Production only via Actions after Convex                                    |
| Smoke test                                       | Production URL    | See release steps above                                                     |
| Link preview                                     | WhatsApp/Telegram | Join URL shows OG image                                                     |

### E2E in CI (optional)

Playwright runs on push/PR when the GitHub secret `E2E_VITE_CONVEX_URL` points at the **dev** Convex deployment (`DEV_MODE=true`); the other `E2E_*` secrets point at the "онова за" dev instance and its `+clerk_test` user (table above, `e2e/README.md`). The CI job is skipped when the secret is unset. Like previews, it runs against whatever functions sit on dev Convex, so push a PR's `convex/` changes with `npx convex dev --once` first. Optional e2e does **not** block the Convex → Vercel production jobs.
