# Google OAuth setup

> **Superseded.** Host Google sign-in is configured in **Clerk**, not Convex Auth.

Use **[clerk-production-setup.md](./clerk-production-setup.md)** — Phase 1, **§1.8 Google SSO (production)** — for:

- OAuth consent screen branding in Google Cloud Console
- OAuth client credentials and the Clerk redirect URI (`https://clerk.onova-za-smetkata.com/v1/oauth_callback`)
- Pasting Client ID / Secret into the Clerk Dashboard

Do **not** use old Convex Auth redirect URIs (`*.convex.site/api/auth/callback/google`) or Convex env vars (`AUTH_GOOGLE_*`, `SITE_URL`).

**Historical context:** [ADR 0001](./adr/0001-google-oauth-branding.md) (consent screen strategy). Auth routing is now [ADR 0002](./adr/0002-clerk-auth-billing.md) (Clerk). Host Pro billing is [ADR 0003](./adr/0003-stripe-billing-beside-clerk.md) (Stripe, not Clerk Billing).
