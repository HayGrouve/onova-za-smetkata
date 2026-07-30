# Research: Google OAuth consent screen branding with Convex Auth

Resolves [#98](https://github.com/HayGrouve/onova-za-smetkata/issues/98). Part of [#97](https://github.com/HayGrouve/onova-za-smetkata/issues/97).

## Question

When using `@convex-dev/auth` with the Google provider, what controls the branding users see on Google's OAuth consent/sign-in popup (app name, logo, domain)? Why might it show "Convex" instead of the app's name, and what can be changed?

## Findings

Google OAuth popup branding is **not controlled by app code** (`convex/auth.ts` has no UI branding). It comes from:

1. **Google Cloud Console OAuth consent screen** — app name, logo, support email, privacy/TOS URLs. External apps need **brand verification** to show custom name/logo instead of domain-only text.
2. **OAuth redirect URI domain** — default Convex Auth callback is `https://<deployment>.convex.site/api/auth/callback/google`, which users often read as "Convex" on the consent screen (especially before verification).
3. **`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`** — must point at _your_ GCP OAuth client, not a tutorial/shared project.

**Optional:** `CUSTOM_AUTH_SITE_URL` + Convex Pro custom domain can replace `*.convex.site` on the consent screen, but still requires GCP branding + verification for name/logo.

**Not the cause:** `applicationID: 'convex'` in `convex/auth.config.ts`, OAuth client internal name, or `SITE_URL` (post-login redirect only).

## Sources

- [Convex Auth — Google OAuth](https://labs.convex.dev/auth/config/oauth/google)
- [Convex Auth — Advanced (`CUSTOM_AUTH_SITE_URL`)](https://labs.convex.dev/auth/advanced)
- [Google Cloud — OAuth consent screen branding](https://support.google.com/cloud/answer/10311615)

## Decision

See [ADR 0001](../adr/0001-google-oauth-branding.md).
