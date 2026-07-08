# Deploy Runbook

## Prerequisites (one-time)

- [ ] GitHub repo connected to Vercel
- [ ] Convex **production** deployment exists
- [ ] Vercel env: `VITE_CONVEX_URL` = prod Convex cloud URL
- [ ] Convex prod env: `GEMINI_API_KEY` (for receipt OCR)
- [ ] Convex prod auth env vars (see below)
- [ ] Google OAuth redirect URI includes prod Convex site callback
- [ ] Resend domain verified; `AUTH_RESEND_FROM` set on prod Convex
- [ ] Optional: `VITE_SENTRY_DSN` on Vercel for client error tracking

## Environment variables

| Variable             | Where                           | Required                                                        |
| -------------------- | ------------------------------- | --------------------------------------------------------------- |
| `VITE_CONVEX_URL`    | Vercel                          | Yes                                                             |
| `VITE_APP_ORIGIN`    | Vercel                          | Yes for production OG/share URLs (`https://onova-za-smetkata.com`) |
| `VITE_SENTRY_DSN`    | Vercel                          | No (Sentry client errors in production)                         |
| `GEMINI_API_KEY`     | Convex Dashboard                | Yes (for OCR)                                                   |
| `GEMINI_MODEL`       | Convex Dashboard                | No                                                              |
| `SITE_URL`           | Convex Dashboard (prod)         | Yes (auth; production HTTPS URL)                                |
| `JWT_PRIVATE_KEY`    | Convex Dashboard (prod)         | Yes (auth; generate via `npx @convex-dev/auth`)                 |
| `JWKS`               | Convex Dashboard (prod)         | Yes (auth)                                                      |
| `AUTH_GOOGLE_ID`     | Convex Dashboard (prod)         | Yes (Google sign-in)                                            |
| `AUTH_GOOGLE_SECRET` | Convex Dashboard (prod)         | Yes                                                             |
| `AUTH_RESEND_KEY`    | Convex Dashboard (prod)         | Yes (magic link email)                                          |
| `AUTH_RESEND_FROM`   | Convex Dashboard (prod)         | No (defaults to Resend onboarding address)                      |
| `DEV_MODE`           | Convex Dashboard (**dev only**) | No — auto sign-in as `Dev User`; **never enable in production** |
| `CONVEX_DEPLOYMENT`  | Local `.env.local`              | Yes (for CLI)                                                   |

Never put `GEMINI_API_KEY`, JWT keys, OAuth secrets, or `DEV_MODE` in Vercel or the repo.

### Security notes

- **Share tokens:** Guest join links require `?t={shareToken}` (e.g. `/bills/{id}/join?t=...`). The token is rotatable from the host invite card (“Обнови линка”). After deploying the share-token schema, run `npx convex run backfill:shareTokens` on each environment once.
- **Capability URLs:** Share join links only with people at the table. Rotating the token invalidates leaked links.
- **Guest sessions:** Assignment mutations require a valid guest session token or host auth. Expired sessions must re-claim a name on the join page.
- **Guest payment privacy:** `getForGuest` returns `myPayments` only — never the full payments list.
- **DEV_MODE:** Password provider is enabled only when `DEV_MODE=true` on an **explicit dev deployment allowlist** (`striped-shepherd-984` plus optional `CONVEX_DEV_DEPLOYMENTS`). Never set `DEV_MODE=true` on production.
- **Guest identity risk:** Guest names are claimable without accounts; if a session expires (~90s without heartbeat), another device can claim the same name. Document as accepted product risk for accountless guests.
- **Rate limits:** Guest claims are limited per actor and per bill; assignment toggles, heartbeats, releases, and receipt uploads are rate-limited server-side.

### Google OAuth redirect URI (production)

Add this authorized redirect URI in Google Cloud Console:

`https://<your-prod-deployment>.convex.site/api/auth/callback/google`

Example: `https://coordinated-warbler-782.convex.site/api/auth/callback/google`

### Sentry

1. Create a Sentry project (React).
2. Set `VITE_SENTRY_DSN` on Vercel.
3. After deploy, trigger a test error and confirm it appears in Sentry.

### Resend

Verify your sending domain in Resend, then set on **production** Convex:

```
AUTH_RESEND_FROM=Онова за сметката <noreply@yourdomain.com>
```

## Vercel project setup

1. Import the GitHub repo in [Vercel](https://vercel.com).
2. Framework: TanStack Start (auto-detected with Nitro plugin).
3. Package manager: pnpm.
4. Node.js: 22 (set in project settings if needed).
5. Build command: `pnpm run build` (default).
6. Environment variables (Production):
   - `VITE_CONVEX_URL=https://coordinated-warbler-782.convex.cloud`
   - `VITE_APP_ORIGIN=https://onova-za-smetkata.com` (required for correct OG previews)
   - Optional: `VITE_SENTRY_DSN`

## Release steps

1. **Preflight locally**

   ```bash
   pnpm install
   pnpm run check && pnpm run lint && pnpm run preflight
   ```

   Requires `VITE_CONVEX_URL` in environment (or `.env.local`).

2. **Schema migration (if upgrading)**

   After deploying schema with `itemAssignments.billId`, run once on each deployment:

   ```bash
   npx convex run backfill:assignmentBillIds
   ```

   After deploying share-token schema, run once on each deployment:

   ```bash
   npx convex run backfill:shareTokens
   ```

3. **Deploy Convex backend**

   ```bash
   npx convex deploy
   ```

   Ensure `CONVEX_DEPLOYMENT` in `.env.local` targets **production**.

4. **Deploy frontend**

   Push to `main`. Vercel runs `pnpm run build` automatically.

   Or use `pnpm run deploy` for Convex backend only (frontend deploys via Vercel Git integration).

5. **Smoke test** (production URL)

   - [ ] Home loads; bills list appears
   - [ ] Sign in (Google + magic link)
   - [ ] Create bill → add participant → add item → assign
   - [ ] QR invite / share link opens guest join flow
   - [ ] Guest can claim items; second device sees name as „Заето“
   - [ ] Summary page; finalize with restaurant name
   - [ ] Finalized bill: guest claim page is read-only
   - [ ] Mark participant paid
   - [ ] Payment settings (Revolut/IBAN) persist after reload
   - [ ] Receipt OCR scan (if Gemini key set)
   - [ ] Add to Home Screen shows branded icon
   - [ ] Browser tab shows favicon
   - [ ] Service worker registered (DevTools → Application → Service Workers)
   - [ ] No devtools panel visible
   - [ ] Summary bottom buttons not clipped on mobile
   - [ ] 404 page on unknown routes
   - [ ] Network tab: `getForGuest` response has `myPayments`, not `payments`
   - [ ] Convex dashboard: `assignments.toggle` without `sessionToken` on guest bill → throws

## Domain cutover (custom domain)

Do this **after** smoke tests pass on `https://<project>.vercel.app`.

### Phase 1 — Verify on Vercel subdomain

1. Deploy to Vercel without attaching custom domain.
2. Smoke test all critical flows on `*.vercel.app`.

### Phase 2 — Attach `onova-za-smetkata.com`

1. Vercel project → **Settings → Domains** → add `onova-za-smetkata.com` and `www.onova-za-smetkata.com`.
2. In Vercel DNS, remove records pointing to Netlify (if present):
   - Delete **A** `@` → Netlify IP
   - Delete **CNAME** `www` → `*.netlify.app`
3. Let Vercel manage apex ALIAS records for the assigned project.
4. Wait for SSL provisioning.
5. Convex prod: `SITE_URL=https://onova-za-smetkata.com`
6. Vercel: `VITE_APP_ORIGIN=https://onova-za-smetkata.com` → redeploy.
7. Re-run smoke tests on `https://onova-za-smetkata.com`.

### Phase 3 — Decommission Netlify

1. Remove custom domains from Netlify site.
2. Disable Netlify deploys or delete the site.
3. Remove Netlify environment variables.

## Troubleshooting

| Symptom                                              | Likely cause                            | Fix                                                     |
| ---------------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| Blank page / config message                          | Missing `VITE_CONVEX_URL` on Vercel     | Set env var; redeploy                                   |
| Build fails on Vercel (`ERR_PNPM_OUTDATED_LOCKFILE`) | `pnpm-lock.yaml` out of sync            | Run `pnpm install` locally; commit lockfile             |
| Build fails on Vercel (other)                        | Missing `VITE_CONVEX_URL`               | Set in Vercel build env                                 |
| Apex domain `DEPLOYMENT_NOT_FOUND`                   | Domain not assigned to Vercel project   | Add domain in Vercel project settings                   |
| Preflight fails on PWA icons                         | PNGs not generated                      | Run `pnpm run generate-icons` and commit                |
| Google sign-in `redirect_uri_mismatch`               | Wrong callback in Google Console        | Add prod `*.convex.site/api/auth/callback/google`       |
| Magic link / `auth:signIn` fails in prod             | Auth env only on dev deployment         | Set `SITE_URL`, JWT keys, Resend key on **prod** Convex |
| OCR always fails                                     | Missing `GEMINI_API_KEY` in Convex prod | Set in Convex Dashboard                                 |
| Data from wrong environment                          | Dev Convex URL in Vercel                | Point Vercel at prod URL                                |
| Guest assignment fails                               | Missing/expired session                 | Re-join and pick name again                             |
| Assignment queries fail after upgrade                | Missing `billId` backfill               | Run `npx convex run backfill:assignmentBillIds`         |

## Production launch checklist

Complete once before calling production “solid”:

| Item | Where | Notes |
|------|--------|-------|
| `VITE_CONVEX_URL` | Vercel | Prod Convex cloud URL |
| `VITE_APP_ORIGIN` | Vercel | `https://onova-za-smetkata.com` for OG/QR |
| `SITE_URL` | Convex prod | Same custom domain for magic links |
| `AUTH_RESEND_FROM` | Convex prod | Verified domain, e.g. `Онова за сметката <noreply@onova-za-smetkata.com>` |
| `AUTH_RESEND_KEY`, JWT, Google OAuth | Convex prod | Dashboard → Settings → Environment |
| `GEMINI_API_KEY` | Convex prod | Receipt OCR |
| `DEV_MODE` | Convex prod | Must **not** be `true` |
| Backfill | Convex prod | `npx convex run backfill:assignmentBillIds` (once) |
| Domain + SSL | Vercel | Custom domain active |
| Netlify decommissioned | Netlify | No stale DNS to old host |
| Smoke test | Production URL | See release steps above |
| Link preview | WhatsApp/Telegram | Join URL shows OG image |
| Optional Sentry | Vercel | `VITE_SENTRY_DSN` |

### E2E in CI (optional)

To run Playwright on push/PR, add GitHub secret `E2E_VITE_CONVEX_URL` pointing at a **dev** Convex deployment with `DEV_MODE=true`. The CI job is skipped when the secret is unset.
