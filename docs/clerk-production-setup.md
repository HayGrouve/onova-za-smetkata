# Clerk auth + billing — production setup

Step-by-step checklist for configuring **Clerk**, **Convex**, and **Vercel** production, then shipping the Clerk migration via GitHub Actions.

**Related docs:** general deploy runbook [`DEPLOY.md`](./DEPLOY.md) · decision record [`adr/0002-clerk-auth-billing.md`](./adr/0002-clerk-auth-billing.md) · implementation spec [`specs/clerk-auth-billing-implementation.md`](./specs/clerk-auth-billing-implementation.md)

**Production references (this project):**

| Resource               | Value                                          |
| ---------------------- | ---------------------------------------------- |
| Convex prod deployment | `coordinated-warbler-782`                      |
| Convex cloud URL       | `https://coordinated-warbler-782.convex.cloud` |
| Convex webhook base    | `https://coordinated-warbler-782.convex.site`  |
| Public site            | `https://onova-za-smetkata.com`                |
| Clerk Frontend API     | `https://clerk.onova-za-smetkata.com`          |
| Deploy trigger         | Push or merge to `main` → GitHub Actions       |

**Status:** Host sign-in (Google + email) verified on production **2026-08-11**. See [Troubleshooting](#troubleshooting) for env/DNS pitfalls encountered during cutover.

---

## Overview

Production releases follow this order:

```text
merge to main → preflight → Convex prod deploy → Vercel prod deploy
```

Vercel **does not** auto-deploy `main` (`vercel.json` disables it). Production frontend deploys only through Actions after Convex succeeds.

---

## Phase 0 — Verify code locally

Before touching production:

```bash
pnpm install
pnpm run ci:preflight
```

Confirm localhost sign-in works against your **dev** Clerk instance and Convex dev deployment (see [`e2e/README.md`](../e2e/README.md) for env shape).

Commit and push any pending Clerk fixes before merging to `main`.

---

## Phase 1 — Clerk production application

Create a **separate production** Clerk application. Do **not** reuse dev/test keys (`pk_test_…` / `sk_test_…`).

### 1.1 Create the app

1. Open [Clerk Dashboard](https://dashboard.clerk.com).
2. Create a **Production** application (or promote dev → prod when ready).

### 1.2 Sign-in methods

**User & Authentication → Social connections / Email**

- Enable **Google** (see [§1.8 Google SSO](#18-google-sso-production-required) — production requires your own Google Cloud credentials)
- Enable **Email** (magic link or verification code)

Google OAuth for **host** sign-in is configured in **Clerk + Google Cloud Console**. The old Convex `@convex-dev/auth` redirect URIs (`*.convex.site/api/auth/callback/google`) are **not** used anymore. See [ADR 0002](./adr/0002-clerk-auth-billing.md).

### 1.3 Localization (Bulgarian)

Clerk does **not** expose a Localization item under **Customization** in the current dashboard (only Avatars, Emails, SMS). Bulgarian UI is configured **in app code**, not in Clerk Dashboard.

The app already passes `bgBG` on `ClerkProvider`:

```tsx
// src/integrations/convex/provider.tsx
<ClerkProvider publishableKey={...} localization={bgBG}>
```

No production dashboard step is required. After deploy, verify sign-in / profile UI strings are in Bulgarian.

Future: when Paraglide i18n lands, sync `localization` with app locale (`bgBG` / `enUS`) per `docs/specs/i18n-implementation.md`.

### 1.4 JWT template for Convex

**JWT Templates → New template**

| Field                 | Value            |
| --------------------- | ---------------- |
| Name                  | `convex` (exact) |
| `applicationID` claim | `convex`         |

Copy the **Frontend API URL** (issuer). With a **custom Clerk domain** (this project), use the `clerk.` subdomain:

```text
https://clerk.onova-za-smetkata.com
```

Without a custom domain, the shape is `https://<your-prod-slug>.clerk.accounts.com`.

This becomes `CLERK_JWT_ISSUER_DOMAIN` on Convex (Phase 2).

### 1.5 API keys

**API Keys**

| Key                       | Used on                               |
| ------------------------- | ------------------------------------- |
| `pk_live_…` (Publishable) | Vercel → `VITE_CLERK_PUBLISHABLE_KEY` |
| `sk_live_…` (Secret)      | Vercel → `CLERK_SECRET_KEY`           |

> **Stack note:** This app is **TanStack Start + Vite**, not Next.js. Use `VITE_CLERK_PUBLISHABLE_KEY` — **not** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`. Clerk’s server middleware also accepts `CLERK_PUBLISHABLE_KEY` (same `pk_live_…` value) as a fallback.

### 1.5.1 Custom domain DNS (Frontend API)

Clerk Dashboard → **Configure → Domains**. After adding the production domain, Clerk shows DNS records for the **`clerk.` subdomain** (Frontend API).

1. Add the **CNAME** from the dashboard to your DNS provider (`clerk.onova-za-smetkata.com` → Clerk’s target).
2. If using **Cloudflare**, set the record to **DNS only** (grey cloud) — orange-cloud proxy breaks Clerk’s DNS check.
3. Wait until Clerk shows **Verified** for DNS and **Issued** for SSL (up to 48h propagation).

**Do not** point `clerk.onova-za-smetkata.com` at Vercel. That hostname must reach Clerk’s Frontend API so the browser can load `@clerk/clerk-js` from:

```text
https://clerk.onova-za-smetkata.com/npm/@clerk/clerk-js@…/dist/clerk.browser.js
```

Detail: `research/clerk-production-auth-diagnosis.md`.

### 1.6 Allowed domains

**Configure → Domains / Paths**

Add production URLs:

- `https://onova-za-smetkata.com`
- `https://www.onova-za-smetkata.com` (if used)
- Your Vercel production URL (for smoke tests before custom domain cutover)

### 1.7 Billing plans (B2C)

**Billing → Plans for Users**

| Slug        | Price            | Notes                                  |
| ----------- | ---------------- | -------------------------------------- |
| `free_user` | $0               | Default; auto-assigned                 |
| `pro`       | ~$3.29/month USD | Monthly only — see currency note below |

> **Clerk Billing currency:** All charges are processed in **USD** regardless of Stripe account locale ([Clerk Billing FAQ](https://clerk.com/docs/guides/billing/overview)). Product copy may still reference ≈€2.99 until [#118](https://github.com/HayGrouve/onova-za-smetkata/issues/118) locks display vs charge wording.

Connect **Stripe** in Clerk Billing for real payments in production. Dev uses Clerk's shared test gateway; prod requires Stripe.

Optional plan features (UX gates only; quotas enforced in Convex):

- `ocr` on `pro`
- `friend_groups` on `pro`

### 1.8 Google SSO (production — required)

Clerk **development** instances can use Clerk's shared Google credentials. **Production** shows **Setup required** until you add your own **Client ID** and **Client Secret** from Google Cloud.

In Clerk: **User & Authentication → Social connections → Google**. Copy the **Authorized Redirect URI** shown there (this project uses a Clerk custom domain):

```text
https://clerk.onova-za-smetkata.com/v1/oauth_callback
```

Use that URI **exactly** in Google Cloud — do not use the old Convex Auth callback URLs.

#### Step A — OAuth consent screen (Google Cloud Console)

If you already configured this for the old Convex Auth flow, review and update it (remove old Convex callback URIs from the OAuth client).

Navigate to **APIs & Services → OAuth consent screen**:

| Field                 | Value                                   |
| --------------------- | --------------------------------------- |
| User type             | **External**                            |
| App name              | `Онова за сметката`                     |
| App logo              | `public/icon-512.png`                   |
| Application home page | `https://onova-za-smetkata.com`         |
| Privacy policy        | `https://onova-za-smetkata.com/privacy` |
| Terms of service      | `https://onova-za-smetkata.com/terms`   |
| Authorized domains    | `onova-za-smetkata.com`                 |

**Scopes** (minimum for sign-in):

- `openid`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`

Submit for **brand verification** if you want the custom app name/logo on Google's consent screen (review can take several days).

#### Step B — OAuth client (Google Cloud Console)

Navigate to **APIs & Services → Credentials → Create credentials → OAuth client ID** (or edit your existing client).

| Field                         | Value                                                   |
| ----------------------------- | ------------------------------------------------------- |
| Application type              | **Web application**                                     |
| Name                          | `Онова за сметката (Clerk prod)`                        |
| Authorized JavaScript origins | _(leave empty)_                                         |
| Authorized redirect URIs      | `https://clerk.onova-za-smetkata.com/v1/oauth_callback` |

Copy the **Client ID** and **Client secret**.

You may keep old `*.convex.site/api/auth/callback/google` URIs on the same client during migration, then remove them after Clerk auth is verified in prod.

#### Step C — Paste into Clerk

Back in Clerk → **Google** connection:

1. Turn on **Use custom credentials** (required on production).
2. Paste **Client ID** and **Client Secret**.
3. Confirm scopes match: `openid`, email, profile.
4. Save.

The **Setup required** badge should clear once credentials are saved.

#### Verify Google sign-in

- [ ] Incognito → `https://onova-za-smetkata.com/login` → **Вход с Google**
- [ ] No `redirect_uri_mismatch`
- [ ] Redirect completes; you land signed in
- [ ] Consent screen shows **Онова за сметката** (after brand verification) or at least your Clerk/app domain

| Symptom                          | Fix                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `redirect_uri_mismatch`          | Redirect URI in Google Cloud must match Clerk's **exactly** (including `https://`) |
| Setup required persists          | Custom credentials toggle on; Client ID/Secret saved                               |
| Wrong app name on Google screen  | Consent screen branding + brand verification in Google Cloud                       |
| Google works in dev but not prod | Expected — prod always needs your own credentials in Clerk                         |

---

## Phase 2 — Convex production environment

Open [Convex Dashboard](https://dashboard.convex.dev) → deployment **`coordinated-warbler-782`** → **Settings → Environment Variables**.

### 2.1 Add or update

| Variable                       | Value                                     |
| ------------------------------ | ----------------------------------------- |
| `CLERK_JWT_ISSUER_DOMAIN`      | `https://clerk.onova-za-smetkata.com`     |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk webhook signing secret (Phase 3)    |
| `GEMINI_API_KEY`               | Keep if receipt OCR is already configured |

### 2.2 Enforce

| Variable   | Rule                                 |
| ---------- | ------------------------------------ |
| `DEV_MODE` | Must **not** be `true` on production |

### 2.3 Remove (legacy auth — optional cleanup)

These belonged to `@convex-dev/auth` and are no longer used after the Clerk migration:

- `JWT_PRIVATE_KEY`, `JWKS`
- `AUTH_GOOGLE_*`, `AUTH_RESEND_*`
- `SITE_URL` (old magic-link base URL)

Removing them avoids confusion; leaving them in place should not break Clerk auth.

---

## Phase 3 — Clerk webhook → Convex

In Clerk Dashboard → **Webhooks → Add endpoint**:

**Endpoint URL:**

```text
https://coordinated-warbler-782.convex.site/clerk/webhook
```

**Subscribe to events:**

- `subscriptionItem.active`
- `subscriptionItem.canceled`
- `subscriptionItem.pastDue`
- `subscription.updated`

Copy the **Signing Secret** → set as `CLERK_WEBHOOK_SIGNING_SECRET` on Convex prod (Phase 2.1).

The handler lives in `convex/http.ts` and mirrors plan state into `users.clerkPlanSlug`, `subscriptionStatus`, etc.

---

## Phase 4 — Vercel production environment

Vercel project → **Settings → Environment Variables → Production**.

Actions runs `vercel pull --environment=production` before build, so these must be set in the Vercel dashboard.

### 4.1 Required

| Variable                     | Value                                          |
| ---------------------------- | ---------------------------------------------- |
| `VITE_CONVEX_URL`            | `https://coordinated-warbler-782.convex.cloud` |
| `VITE_APP_ORIGIN`            | `https://onova-za-smetkata.com`                |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_…` from Clerk prod                    |
| `CLERK_SECRET_KEY`           | `sk_live_…` from Clerk prod                    |

### 4.2 Recommended

| Variable                | Value                     |
| ----------------------- | ------------------------- |
| `CLERK_PUBLISHABLE_KEY` | Same `pk_live_…` as above |

`@clerk/tanstack-react-start` reads `VITE_CLERK_PUBLISHABLE_KEY` first, then `CLERK_PUBLISHABLE_KEY`. Setting both avoids SSR middleware “Publishable key is missing” if only one prefix is visible at runtime.

### 4.3 Optional

| Variable          | Purpose               |
| ----------------- | --------------------- |
| `VITE_SENTRY_DSN` | Client error tracking |

### 4.4 Do not set (unless you know why)

These are **not** in the TanStack Start quickstart and caused production incidents when mis-set:

| Variable                                          | Why avoid                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`               | Next.js prefix — **ignored** by this Vite app                                                                 |
| `CLERK_JS_URL` / `CLERK_JS` / `VITE_CLERK_JS_URL` | Wrong value → browser requests `https://npm/@clerk/clerk-js@…` (`ERR_NAME_NOT_RESOLVED`); SignIn never mounts |
| `CLERK_PROXY_URL` / `VITE_CLERK_PROXY_URL`        | Only for [FAPI proxy](https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi) setups                  |
| `CLERK_DOMAIN`                                    | Satellite-domain setups only                                                                                  |

After any env change, **redeploy** via GitHub Actions (`vercel pull` bakes Production env at build time).

Never commit secrets to the repo.

---

## Phase 5 — Clean production data before deploy

The Clerk migration requires `users.clerkSubject`. Rows from the old `@convex-dev/auth` Password/OAuth flow (e.g. with `emailVerificationTime` but no `clerkSubject`) **block** `convex deploy` schema validation — the same failure you may have seen on dev.

### 5.1 Inspect

Convex Dashboard → prod → **Data → users**

Delete any rows missing `clerkSubject`.

Pre-public policy (see ADR 0002): wiping test users on prod is acceptable; there is no email-link migration runbook.

### 5.2 Optional CLI wipe (dev/test data only)

Only if you intentionally want an empty `users` table:

```bash
echo '[]' > /tmp/empty-users.json
npx convex import --table users --replace -y --format jsonArray /tmp/empty-users.json --prod
```

Legacy auth tables (`authSessions`, `authAccounts`, …) are not in the current schema and should disappear after a successful schema push.

---

## Phase 6 — GitHub Actions secrets

Repository → **Settings → Secrets and variables → Actions**

Confirm these secrets exist:

| Secret              | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `CONVEX_DEPLOY_KEY` | Production deploy key (`deployment:deploy`) for `npx convex deploy` |
| `VERCEL_TOKEN`      | Vercel CLI access token                                             |
| `VERCEL_ORG_ID`     | Vercel organization ID                                              |
| `VERCEL_PROJECT_ID` | Vercel project ID                                                   |

---

## Phase 7 — Merge and deploy

### 7.1 Recommended path

1. Open a PR into `main`.
2. Wait for the **preflight** job to pass on the PR.
3. Merge to `main`.

### 7.2 What Actions runs on `main`

| Job                          | What it does                                                              |
| ---------------------------- | ------------------------------------------------------------------------- |
| `preflight`                  | Format, lint, test, build                                                 |
| `Deploy Convex (production)` | `npx convex deploy`                                                       |
| `Deploy Vercel (production)` | `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` |

Optional **e2e** runs only when `E2E_VITE_CONVEX_URL` is set; it does **not** gate production deploy.

### 7.3 If deploy fails

| Failure                   | Action                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| Convex schema validation  | Clean legacy `users` rows (Phase 5)                                                         |
| Convex deploy (secrets)   | Fix `CONVEX_DEPLOY_KEY`                                                                     |
| Vercel after Convex green | Fix Vercel env vars or build; re-run failed job. Do **not** roll back Convex automatically. |

Emergency manual Convex deploy (break-glass only):

```bash
npx convex deploy
```

Prefer the Actions path. See [`DEPLOY.md`](./DEPLOY.md).

---

## Phase 8 — Production smoke test

Run on `https://onova-za-smetkata.com` (or Vercel prod URL before domain cutover).

### Auth

- [x] Home loads (no „Липсва конфигурация…“ screens) — verified 2026-08-11
- [x] Sign in with **Google** or **email** (Clerk prod UI at `/login`) — verified 2026-08-11
- [x] Brief „Зареждане…“ then host home loads (`ensureCurrent` creates Convex user row) — verified 2026-08-11

### Host flows

- [ ] Create bill → add participant → add item → assign
- [ ] Summary page; finalize with restaurant name
- [ ] Mark participant paid
- [ ] Payment settings (Revolut/IBAN) persist after reload
- [ ] Receipt OCR scan (requires `GEMINI_API_KEY`)

### Guest flows (unchanged by Clerk)

- [ ] QR / share link opens guest join (`?t={shareToken}`)
- [ ] Guest can claim items; second device sees name as „Заето“
- [ ] Finalized bill: guest claim page is read-only

### Billing (optional)

- [ ] Hit a free-tier limit → paywall appears
- [ ] Upgrade to Pro via Clerk checkout
- [ ] Clerk webhook delivers successfully
- [ ] Convex `users` row shows `clerkPlanSlug: "pro"`, `subscriptionStatus: "active"`
- [ ] Pro limits unlock (unlimited bills/OCR, more friend groups)

Full checklist: [`DEPLOY.md` — Smoke test](./DEPLOY.md#release-steps).

---

## Environment matrix (quick reference)

| Variable                       | Convex prod  | Vercel prod |
| ------------------------------ | ------------ | ----------- |
| `CLERK_JWT_ISSUER_DOMAIN`      | ✅           | —           |
| `CLERK_WEBHOOK_SIGNING_SECRET` | ✅ (billing) | —           |
| `GEMINI_API_KEY`               | ✅           | —           |
| `DEV_MODE`                     | ❌ never     | —           |
| `VITE_CONVEX_URL`              | —            | ✅          |
| `VITE_APP_ORIGIN`              | —            | ✅          |
| `VITE_CLERK_PUBLISHABLE_KEY`   | —            | ✅          |
| `CLERK_PUBLISHABLE_KEY`        | —            | recommended |
| `CLERK_SECRET_KEY`             | —            | ✅          |

---

## Troubleshooting

| Symptom                                                                                | Likely cause                                                                    | Fix                                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Vercel 500: **Publishable key is missing**                                             | `NEXT_PUBLIC_*` instead of `VITE_*`, or publishable key removed                 | Set `VITE_CLERK_PUBLISHABLE_KEY` (+ optional `CLERK_PUBLISHABLE_KEY`); delete `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; redeploy |
| `/login` shows text but **no Clerk form**; console `GET https://npm/@clerk/clerk-js@…` | Mis-set `CLERK_JS_URL` / `CLERK_JS`, or `clerk.` subdomain DNS points at Vercel | Remove bad `CLERK_JS_*` vars; fix Clerk FAPI CNAME (§1.5.1); redeploy                                                       |
| Home / login stuck on **„Зареждане…“**                                                 | Clerk JS never loads (`isLoaded` false)                                         | Same as above; Network tab should show **200** from `clerk.onova-za-smetkata.com/npm/@clerk/clerk-js@…`                     |
| Convex deploy: missing `clerkSubject`                                                  | Legacy user rows                                                                | Delete or wipe `users` (Phase 5)                                                                                            |
| Sign-in OK, app stuck on „Зареждане…“ **after** Clerk UI                               | JWT issuer mismatch                                                             | Set `CLERK_JWT_ISSUER_DOMAIN` = `https://clerk.onova-za-smetkata.com` on Convex prod                                        |
| „Липсва конфигурация на входа“                                                         | Missing publishable key in client bundle                                        | Set `VITE_CLERK_PUBLISHABLE_KEY` on Vercel prod; redeploy                                                                   |
| Host queries throw „Изисква се вход“ right after login                                 | Race before user row exists                                                     | Ensure latest `EnsureConvexUser` + `users.ensureCurrent` are deployed                                                       |
| Pro upgrade doesn't apply                                                              | Webhook misconfiguration                                                        | Verify webhook URL, signing secret, and Clerk delivery logs                                                                 |
| Google sign-in `redirect_uri_mismatch`                                                 | Domain not allowed in Clerk / Google                                            | Add prod domain in Clerk; Google redirect = §1.8                                                                            |
| OCR fails                                                                              | Missing Gemini key                                                              | Set `GEMINI_API_KEY` on Convex prod                                                                                         |

---

## Architecture reminder

| Layer           | Owns                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------- |
| **Clerk**       | Sign-in UI, checkout, subscription lifecycle, plan/feature claims                             |
| **Convex**      | `users.clerkSubject`, plan mirror from webhooks, monthly quota counters, mutation enforcement |
| **Guest flows** | Unchanged — share tokens and `guestSessions`                                                  |

Google OAuth for **host** sign-in is configured in the **Clerk Dashboard**, not via Convex `@convex-dev/auth`.
