# ADR 0002: Clerk auth + Billing

**Status:** Accepted (supersedes [ADR 0001](./0001-google-oauth-consent-screen-branding.md))

## Context

Host authentication previously used `@convex-dev/auth` (Google OAuth, Resend magic link, dev Password provider). Product decision [#108](https://github.com/HayGrouve/onova-za-smetkata/issues/108): migrate to **Clerk** for sign-in and **Clerk Billing** for Free/Pro SaaS tiers.

Guest flows (share tokens, `guestSessions`) are unchanged.

## Decision

- **Clerk** — sign-in UI (Google + email), user profile, checkout, subscription lifecycle.
- **Convex** — `users.clerkSubject` mapping, plan mirror from webhooks, monthly bill/OCR quota counters, mutation enforcement.
- **TanStack Start** — `ClerkProvider` → `ConvexProviderWithClerk`; `clerkMiddleware()` in `src/start.ts`.

Google OAuth consent screen branding is configured in the **Clerk Dashboard**, not Google Cloud Console redirect URIs on Convex.

## Consequences

- Remove `@convex-dev/auth`, `authTables`, JWT/OAuth/Resend env vars.
- Add `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`, `CLERK_WEBHOOK_SIGNING_SECRET`.
- E2E uses [Clerk Testing Tokens](https://clerk.com/docs/testing/overview), not `DEV_MODE` password auth.
- Pre-public: fresh Convex deployment acceptable; no email-link user migration.
