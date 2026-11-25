# Google OAuth setup

> **Superseded.** Host Google sign-in belongs to the shared Акаунт's Clerk app "онова за" and its Google client, set up by the hub: [HayGrouve/onova-za#26](https://github.com/HayGrouve/onova-za/issues/26). Сметката configures no OAuth client ([ADR 0005](./adr/0005-sign-in-and-akaunt-on-the-hub.md)).

Do **not** use old Convex Auth redirect URIs (`*.convex.site/api/auth/callback/google`) or Convex env vars (`AUTH_GOOGLE_*`, `SITE_URL`), nor the retired app's callback on `clerk.onova-za-smetkata.com`.

**Historical context:** [ADR 0001](./adr/0001-google-oauth-branding.md) (consent screen strategy), [ADR 0002](./adr/0002-clerk-auth-billing.md) (Clerk).
