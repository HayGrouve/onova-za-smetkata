# ADR 0002: Clerk for Host authentication

**Status:** Accepted for **Clerk auth**. Host Pro charging is **Stripe Billing** — [ADR 0003](./0003-stripe-billing-beside-clerk.md). This ADR supersedes [ADR 0001](./0001-google-oauth-branding.md) for where Google OAuth is configured.

## Context

Host authentication previously used `@convex-dev/auth` (Google OAuth, Resend magic link, dev Password provider). Hosts now sign in with **Clerk**. An earlier product ticket also chose Clerk Billing for Free/Pro; that half is withdrawn.

Guest flows (share tokens, `guestSessions`) are unchanged.

## Decision

- **Clerk** — Host sign-in UI (Google + email) and user profile. Not checkout, not subscriptions.
- **Convex** — `users.clerkSubject` mapping; monthly bill/OCR quota counters and mutation enforcement (`hostTier`).
- **TanStack Start** — `ClerkProvider` → `ConvexProviderWithClerk`; `clerkMiddleware()` in `src/start.ts`.

Google OAuth consent screen branding is configured in the **Clerk Dashboard** (plus Google Cloud credentials for production), not Convex Auth redirect URIs on `*.convex.site`.

## Consequences

- Remove `@convex-dev/auth`, `authTables`, JWT/OAuth/Resend env vars.
- Add `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_ISSUER_DOMAIN`.
- E2E uses [Clerk Testing Tokens](https://clerk.com/docs/testing/overview), not `DEV_MODE` password auth.
- Pre-public: fresh Convex deployment acceptable; no email-link user migration.
- Do **not** enable Clerk Billing. Host Pro is Stripe — ADR 0003.
