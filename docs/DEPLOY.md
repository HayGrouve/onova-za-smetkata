# Deploy Runbook

## Prerequisites (one-time)

- [ ] GitHub repo connected to Netlify
- [ ] Convex **production** deployment exists
- [ ] Netlify env: `VITE_CONVEX_URL` = prod Convex cloud URL
- [ ] Convex prod env: `GEMINI_API_KEY` (for receipt OCR)
- [ ] Convex prod auth env vars (see below)
- [ ] Google OAuth redirect URI includes prod Convex site callback

## Environment variables

| Variable | Where | Required |
|----------|-------|----------|
| `VITE_CONVEX_URL` | Netlify | Yes |
| `VITE_APP_ORIGIN` | Netlify | No (QR/share links; falls back to `window.location.origin`) |
| `GEMINI_API_KEY` | Convex Dashboard | Yes (for OCR) |
| `GEMINI_MODEL` | Convex Dashboard | No |
| `SITE_URL` | Convex Dashboard (prod) | Yes (auth; Netlify HTTPS URL) |
| `JWT_PRIVATE_KEY` | Convex Dashboard (prod) | Yes (auth; generate via `npx @convex-dev/auth`) |
| `JWKS` | Convex Dashboard (prod) | Yes (auth) |
| `AUTH_GOOGLE_ID` | Convex Dashboard (prod) | Yes (Google sign-in) |
| `AUTH_GOOGLE_SECRET` | Convex Dashboard (prod) | Yes |
| `AUTH_RESEND_KEY` | Convex Dashboard (prod) | Yes (magic link email) |
| `DEV_MODE` | Convex Dashboard (**dev only**) | No — auto sign-in as `Dev User`; **never enable in production** |
| `CONVEX_DEPLOYMENT` | Local `.env.local` | Yes (for CLI) |

Never put `GEMINI_API_KEY`, JWT keys, OAuth secrets, or `DEV_MODE` in Netlify or the repo.

### Google OAuth redirect URI (production)

Add this authorized redirect URI in Google Cloud Console:

`https://<your-prod-deployment>.convex.site/api/auth/callback/google`

Example: `https://coordinated-warbler-782.convex.site/api/auth/callback/google`

## Release steps

1. **Preflight locally**

   ```bash
   pnpm install
   pnpm run preflight
   ```

   Requires `VITE_CONVEX_URL` in environment (or `.env.local`).

2. **Deploy Convex backend**

   ```bash
   npx convex deploy
   ```

   Ensure `CONVEX_DEPLOYMENT` in `.env.local` targets **production**.

3. **Deploy frontend**

   Push to `main`. Netlify runs `pnpm run build` and publishes `dist/client`.

4. **Smoke test** (production URL)

   - [ ] Home loads; bills list appears
   - [ ] Sign in (Google + magic link)
   - [ ] Create bill → add participant → add item → assign
   - [ ] QR invite / share link opens guest join flow
   - [ ] Summary page; finalize with restaurant name
   - [ ] Mark participant paid
   - [ ] Payment settings (Revolut/IBAN) persist after reload
   - [ ] Receipt OCR scan (if Gemini key set)
   - [ ] Add to Home Screen shows branded icon
   - [ ] No devtools panel visible
   - [ ] Summary bottom buttons not clipped on mobile

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Blank page / config message | Missing `VITE_CONVEX_URL` on Netlify | Set env var; redeploy |
| Build fails on Netlify (`ERR_PNPM_OUTDATED_LOCKFILE`) | `pnpm-lock.yaml` out of sync | Run `pnpm install` locally; commit lockfile |
| Build fails on Netlify (other) | Missing `VITE_CONVEX_URL` | Set in Netlify build env |
| Google sign-in `redirect_uri_mismatch` | Wrong callback in Google Console | Add prod `*.convex.site/api/auth/callback/google` |
| Magic link / `auth:signIn` fails in prod | Auth env only on dev deployment | Set `SITE_URL`, JWT keys, Resend key on **prod** Convex |
| OCR always fails | Missing `GEMINI_API_KEY` in Convex prod | Set in Convex Dashboard |
| Data from wrong environment | Dev Convex URL in Netlify | Point Netlify at prod URL |
