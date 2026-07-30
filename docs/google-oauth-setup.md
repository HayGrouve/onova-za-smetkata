# Google OAuth setup

Team runbook for **Онова за сметката** Google sign-in branding. Implements [#102](https://github.com/HayGrouve/onova-za-smetkata/issues/102). Decisions: [ADR 0001](./adr/0001-google-oauth-branding.md).

## Prerequisites

- Access to the project's Google Cloud Console (OAuth consent screen + OAuth client)
- Convex Dashboard access for prod and dev deployments
- Production site live at `https://onova-za-smetkata.com` with privacy and terms pages

## 1. OAuth consent screen (Google Cloud Console)

Navigate to **APIs & Services → OAuth consent screen**.

| Field                 | Value                                                                      |
| --------------------- | -------------------------------------------------------------------------- |
| User type             | **External**                                                               |
| App name              | `Онова за сметката`                                                        |
| User support email    | Team contact (e.g. project owner email)                                    |
| App logo              | Upload `public/icon-512.png` (512×512 PNG; Google accepts down to 120×120) |
| Application home page | `https://onova-za-smetkata.com`                                            |
| Privacy policy        | `https://onova-za-smetkata.com/privacy`                                    |
| Terms of service      | `https://onova-za-smetkata.com/terms`                                      |
| Authorized domains    | `onova-za-smetkata.com`                                                    |
| Developer contact     | Team email                                                                 |

### Scopes

Keep the minimum required for sign-in:

- `openid`
- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`

### Brand verification

Google requires **brand verification** before external users see the custom app name and logo (instead of domain-only text). After configuring the consent screen:

1. Submit for verification in the consent screen UI
2. Provide the privacy policy and terms URLs (hosted on our domain)
3. Wait for Google review (can take several days)

Until verification completes, the consent screen may show only the domain — this is expected.

## 2. OAuth client credentials

Navigate to **APIs & Services → Credentials → Create credentials → OAuth client ID**.

| Field                         | Value                                                        |
| ----------------------------- | ------------------------------------------------------------ |
| Application type              | **Web application**                                          |
| Name                          | `Онова за сметката (Convex Auth)`                            |
| Authorized JavaScript origins | _(leave empty — Convex Auth uses server-side redirect flow)_ |
| Authorized redirect URIs      | See below                                                    |

### Authorized redirect URIs

Add **both** deployment callbacks on the **same** OAuth client:

```
https://coordinated-warbler-782.convex.site/api/auth/callback/google
https://striped-shepherd-984.convex.site/api/auth/callback/google
```

For a personal `npx convex dev` deployment, add:

```
https://<your-deployment>.convex.site/api/auth/callback/google
```

Copy the **Client ID** and **Client secret**.

## 3. Convex environment variables

Set on **each** Convex deployment that uses Google sign-in:

| Variable             | Value                                                      |
| -------------------- | ---------------------------------------------------------- |
| `AUTH_GOOGLE_ID`     | OAuth client ID from step 2                                |
| `AUTH_GOOGLE_SECRET` | OAuth client secret from step 2                            |
| `SITE_URL`           | `https://onova-za-smetkata.com` (prod) or local dev origin |

Prod deployment: `coordinated-warbler-782`  
Shared dev deployment: `striped-shepherd-984`

See also [DEPLOY.md](./DEPLOY.md) for the full env var table.

## 4. Verification checklist

Run through this after any OAuth config change:

### Production

- [ ] Open `https://onova-za-smetkata.com/login` in an incognito window
- [ ] Tap **Вход с Google**
- [ ] Consent screen shows **Онова за сметката** (after brand verification) or at minimum not a third-party/tutorial app name
- [ ] Redirect completes; you land back on the app signed in
- [ ] No `redirect_uri_mismatch` error

### Shared dev

- [ ] Point local `.env.local` at `striped-shepherd-984` (or use dev deployment URL)
- [ ] Sign in with Google on `/login`
- [ ] Callback succeeds against dev redirect URI

### Privacy / terms URLs

- [ ] `https://onova-za-smetkata.com/privacy` loads (200)
- [ ] `https://onova-za-smetkata.com/terms` loads (200)

## Troubleshooting

| Symptom                            | Fix                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `redirect_uri_mismatch`            | Add the exact `https://<deployment>.convex.site/api/auth/callback/google` URI to the OAuth client |
| Shows wrong app name / "Convex"    | Configure consent screen + submit brand verification; confirm `AUTH_GOOGLE_ID` is _your_ client   |
| Sign-in works locally but not prod | Check prod Convex has `AUTH_GOOGLE_*` and prod redirect URI in Google Console                     |
| Magic link works, Google doesn't   | Google credentials missing on that deployment only                                                |

## Out of scope (future)

- **`CUSTOM_AUTH_SITE_URL`** — custom auth domain on `onova-za-smetkata.com` instead of `*.convex.site`; requires Convex Pro. See ADR 0001.
- **In-app login button redesign** — already branded; no code change needed.

## References

- [Research: Google OAuth consent screen branding](./research/google-oauth-consent-screen-branding.md)
- [Convex Auth — Google OAuth](https://labs.convex.dev/auth/config/oauth/google)
- [Google — OAuth consent screen branding](https://support.google.com/cloud/answer/10311615)
