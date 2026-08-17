# Google OAuth branding strategy

**Status:** Auth **routing** superseded by [ADR 0002](./0002-clerk-auth-billing.md) (Clerk). Consent-screen branding (app name, logo, privacy/terms) still applies in Google Cloud; the callback is Clerk’s URI, not `*.convex.site`. Host Pro is Stripe — [ADR 0003](./0003-stripe-billing-beside-clerk.md).

Google sign-in branding is controlled by the Google Cloud OAuth consent screen and the OAuth callback domain — not by app code. We configure one GCP project with app name **Онова за сметката**, our logo, and privacy/terms URLs.

## Target outcome (#99)

Hosts tapping „Вход с Google“ should see:

- **App name:** Онова за сметката (after Google brand verification)
- **Logo:** `public/icon-512.png` uploaded to the consent screen
- **Domain line:** `<deployment>.convex.site` — acceptable; users already trust Google’s flow and our in-app login page is branded
- **Post-login redirect:** `https://onova-za-smetkata.com` via Convex `SITE_URL`

In-app sign-in UI changes are out of scope; the login page is already branded.

## OAuth client per environment (#100)

- **One GCP project**, one OAuth consent screen, **one OAuth client** with multiple authorized redirect URIs
- **Production** Convex (`coordinated-warbler-782`): `https://coordinated-warbler-782.convex.site/api/auth/callback/google`
- **Shared dev** Convex (`striped-shepherd-984`): `https://striped-shepherd-984.convex.site/api/auth/callback/google`
- Same `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` on both deployments
- Personal `npx convex dev` deployments: use the shared dev deployment for Google sign-in testing, or add that deployment’s `*.convex.site` callback to the same client

## Custom auth domain (#101)

Do **not** set `CUSTOM_AUTH_SITE_URL` now. It requires Convex Pro custom domain setup and DNS for auth endpoints; the GCP consent screen covers name and logo. Revisit if user feedback shows distrust of the `convex.site` domain line.

## Considered options

| Option                                            | Why not (for now)                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| Separate OAuth clients per environment            | More secrets to rotate; no isolation benefit at current scale                  |
| `CUSTOM_AUTH_SITE_URL` on `onova-za-smetkata.com` | Extra infra (Convex Pro, DNS, SSL); consent screen branding is the primary fix |
| Code changes in `convex/auth.ts`                  | Convex Auth Google provider has no UI branding knobs                           |

Setup steps: **`docs/clerk-production-setup.md`** §1.8 (supersedes `docs/google-oauth-setup.md`).
