# ADR 0005: Host sign-in and the Акаунт live on the hub

**Status:** Accepted (cutover release, HayGrouve/onova-za-smetkata#211). Partly supersedes [ADR 0002](./0002-clerk-auth-billing.md): Clerk still authenticates Hosts, but Сметката no longer renders Clerk's sign-in UI or user profile. [ADR 0001](./0001-google-oauth-branding.md) (the old app's Google OAuth client) is retired with the old Clerk app.

## Context

The "онова за" projects share one Акаунт: a single Clerk production app ("онова за") on `clerk.onovaza.com`, each project on `<name>.onovaza.com` (the hub's [ADR 0001](https://github.com/HayGrouve/onova-za/blob/main/docs/adr/0001-one-akaunt-on-onovaza-subdomains.md)). Sign-in (`/vhod`), the Акаунт (`/akaunt`) and the legal texts (`/poveritelnost`, `/usloviya`, one section per project) live on the hub, onovaza.com. Сметката moves from its own Clerk app on onova-za-smetkata.com to `https://smetkata.onovaza.com`. Plan: HayGrouve/onova-za#32 (decisions 2, 3, 4, 6, 8, 12).

## Decision

- **Sign-in on the hub.** Production sets `VITE_CLERK_SIGN_IN_URL` and `VITE_CLERK_SIGN_UP_URL` to `https://onovaza.com/vhod`; `clerkMiddleware` reads them per request. `/login` keeps its `?redirect=` contract (old links, `useRequireHostAuth`) but renders no form: signed out it calls `redirectToSignIn` with the full return URL, so the Host comes back to the exact page. Where the sign-in URLs are unset (local, Vercel Preview and Development) Clerk falls back to the dev instance's Account Portal. A relative sign-in URL is never set: `/login` would redirect to itself.
- **No Clerk UI in Сметката.** No `SignIn`, `UserButton` or `UserProfile`; no Clerk localization or appearance. The avatar is our own shadcn dropdown with exactly „Акаунт“ (`https://onovaza.com/akaunt`) and „Изход“ (`signOut`, back to `/`). `ClerkProvider`, `ConvexProviderWithClerk` and the Guest page gating stay.
- **Абонамент is Сметката's own** `/abonament`. `/user-profile` and `/user-profile/*` answer 308 to it with the query, so old Stripe returns still land.
- **Legal texts on the hub.** `/privacy` and `/terms` answer 308 to `https://onovaza.com/poveritelnost#smetkata` and `https://onovaza.com/usloviya#smetkata`. Redirects live in route code (`redirect` with `statusCode: 308`), not `vercel.json`, which the Nitro build may not honour.
- **SSR `authorizedParties`.** Every project gets session tokens from the same Clerk instance, so SSR accepts only tokens whose `azp` is Сметката's origin: `clerkMiddleware({ authorizedParties })` from the server env `CLERK_AUTHORIZED_PARTIES`, read per request and passed only when set (Production). Convex has the same check behind its own `CLERK_AUTHORIZED_PARTIES` (HayGrouve/onova-za-smetkata#206).
- **One origin.** `https://smetkata.onovaza.com` is the canonical origin (`DEFAULT_SITE_ORIGIN`, sitemap, robots) and, through `VITE_APP_ORIGIN`, the share-link origin in Production.
- **No Sentry.** The CSP stays report-only without a report endpoint; violations are read in the browser console.

## Consequences

- Production needs, before this release deploys: the new app's `pk_live_` and the `smetkata` secret key, the sign-in URLs, `CLERK_AUTHORIZED_PARTIES` and `VITE_APP_ORIGIN` on Vercel, and Convex prod's `CLERK_JWT_ISSUER_DOMAIN=https://clerk.onovaza.com` (runbook: HayGrouve/onova-za-smetkata#212). `docs/DEPLOY.md` has the matrix.
- Previews and local dev need none of that and run on the dev instance.
- `/vhod` only accepts and names `smetkata.onovaza.com` once the hub marks Сметката as an Акаунт project (HayGrouve/onova-za#65).
- Deleting the Акаунт happens on the hub and reaches Сметката through `user.deleted`; Изтрий данните in the Данни sheet removes only Сметката's data.
- Turnstile is out of the CSP: bot protection runs on `/vhod`.
- `docs/clerk-production-setup.md` is history; the shared production checklist is HayGrouve/onova-za#26.
