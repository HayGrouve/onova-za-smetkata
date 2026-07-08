# Production Readiness Audit

**Status:** Remediated (2026-07-08)  
**Date:** 2026-07-08  
**Scope:** Security, metadata/PWA, ops, QA — post-Vercel migration, pre-“100% confident” launch

---

## Remediation summary (2026-07-08)

| Audit item | Status |
|------------|--------|
| Favicon + head links | ✅ `public/favicon.ico`, links in `__root.tsx` |
| Guest claim rate limit | ✅ Keyed by `claim:bill:${billId}` |
| Branded magic-link email | ✅ `convex/lib/magicLinkEmail.ts` + `auth.ts` |
| Service worker | ✅ `public/sw.js` + prod registration |
| Manifest `id` / `scope` | ✅ `public/manifest.json` |
| OG image dimensions | ✅ `og:image:width/height` in `site-meta.ts` |
| Security headers | ✅ Nitro `routeRules` in `vite.config.ts` |
| E2E in CI | ✅ Optional job gated on `E2E_VITE_CONVEX_URL` secret |
| Stray Zone.Identifier files | ✅ Removed |

**Still manual:** prod env checklist, smoke test, link preview verification, optional Sentry DSN.

---

## Executive summary

The app is **production-viable** for a small trusted-user bill splitter: host auth is enforced in Convex, guest mutations require sessions, DEV_MODE is blocked on prod, CI runs preflight, and share-friendly SEO is in place.

**Not blockers but should fix soon:** missing favicon, weak guest claim rate-limit key, uncommitted verification that prod Convex env/backfill are complete.

**Accepted risks (documented):** bill join URLs are capability links; guests with a bill ID can read bill structure via `getForGuest`.

---

## Severity legend

| Level | Meaning |
|-------|---------|
| 🔴 High | Fix before calling production “solid” |
| 🟡 Medium | Fix soon or explicitly accept |
| 🟢 Low | Nice-to-have / polish |

---

## Security

### 🟢 Guest claim rate limit

Fixed: `guestSessions.claim` rate-limits by `claim:bill:${billId}` (40/min) so rotating session tokens cannot bypass the cap.

### 🟡 Capability URLs (by design)

- `bills.getForGuest` returns participants, items, assignments to anyone with `billId` (no auth).
- Join links are guessable if Convex IDs leak.
- Documented in `docs/DEPLOY.md`; acceptable for “people at the table” use case.

### 🟡 `listActiveForBill` is public

Reveals which participants have active guest sessions. Low sensitivity but aids reconnaissance on open bills.

### 🟡 `paymentSettings.getForGuest` exposes Revolut username

Anyone with `billId` can read host’s `revolutUsername` (not IBAN). Intentional for guest payments; confirm product acceptance.

### 🟢 Host mutations protected

`requireAuth`, `requireBillOwner`, `assertCanMutateAssignment`, `requireGuestSession` wired correctly on assignments and guest flows.

### 🟢 DEV_MODE guard

`isDevModeEnabled()` blocks Password provider on `coordinated-warbler-782`. Client `DevAutoSignIn` only runs when `import.meta.env.DEV`.

### 🟢 OCR rate limit

`receiptScan` limited to 10/hour per bill.

### 🟢 HTTP security headers

Nitro `routeRules` in `vite.config.ts` set `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` on all routes.

### 🟢 Magic link email

Branded Bulgarian HTML via `sendVerificationRequest` in `convex/auth.ts` and `convex/lib/magicLinkEmail.ts`. `AUTH_RESEND_FROM` should be set on prod Convex.

---

## Metadata, favicon, PWA (ICO)

### 🟢 Service worker (v1)

Static asset precache + network-first navigations via `public/sw.js`. Registered in production only.

### 🟢 Favicon

- `public/favicon.ico` committed
- `<link rel="icon">` in `__root.tsx` head

### 🟢 PWA manifest & icons

- `manifest.json` valid; icons from `logo.png` via `generate-pwa-icons.mjs`
- `apple-touch-icon` linked in root head
- Preflight checks `logo.png`, `favicon.ico`, icon PNGs, `og-image.png`

### 🟢 Manifest

- `id` and `scope` set to `/`
- Icons from `logo.png` via `generate-pwa-icons.mjs`

### 🟢 Open Graph / SEO (recent work)

- `site-meta.ts` with OG + Twitter on `/` and join pages
- `robots.txt` blocks `/bills/`, `/login`
- `sitemap.xml` homepage only
- Private routes use `noindex`

### 🟢 OG polish

- `og:image:width` / `og:image:height` (1200×630) in `site-meta.ts`
- Absolute URLs depend on `VITE_APP_ORIGIN` on Vercel — set to `https://onova-za-smetkata.com`

### 🟢 Service worker

Lightweight SW (`public/sw.js`) precaches static branding assets; registered in production only. Offline banner still handles connectivity UX.

---

## Ops & deployment

### Verify manually (checklist)

| Item | Where | Status |
|------|--------|--------|
| `VITE_CONVEX_URL` prod | Vercel | User reports app works ✅ |
| `VITE_APP_ORIGIN` | Vercel | Confirm for OG URLs |
| `SITE_URL` | Convex prod | Must match custom domain for magic links |
| `AUTH_RESEND_FROM` | Convex prod | User configured ✅ |
| `AUTH_RESEND_KEY`, JWT, Google OAuth | Convex prod | Verify in dashboard |
| `GEMINI_API_KEY` | Convex prod | For OCR |
| `DEV_MODE` | Convex prod | Must **not** be `true` |
| Backfill `assignmentBillIds` | Convex prod | Run once if not done: `npx convex run backfill:assignmentBillIds` |
| Domain + SSL | Vercel | User on custom domain |
| Netlify decommissioned | Netlify | Confirm no stale DNS |

### 🟢 E2E in CI (optional)

Playwright job in `.github/workflows/ci.yml`, gated on `E2E_VITE_CONVEX_URL` GitHub secret (dev deployment with `DEV_MODE=true`).

### 🟡 Sentry optional

`SentryInit` only loads if `VITE_SENTRY_DSN` set. Without it, client errors are invisible in prod.

### 🟢 CI

GitHub Actions: prettier, lint, preflight (unit tests + icons + build).

---

## QA / functional gaps

### Recommended smoke test (production)

From `docs/DEPLOY.md`:

- [ ] Home, sign-in (Google + magic link)
- [ ] Create bill → participant → item → assign
- [ ] QR/share join on second device; name conflict (“Заето”)
- [ ] Guest claim + host sees updates
- [ ] Finalize bill → guest read-only
- [ ] Payment settings persist
- [ ] OCR (if Gemini key set)
- [ ] 404 route
- [ ] `getForGuest` returns `myPayments` only (network tab)
- [ ] Link preview for join URL shows logo OG image

### 🟡 Uncommitted / stray files

- `public/logo-removebg-preview.png:Zone.Identifier` if present — should not ship

---

## Recommended fix order

1. **Favicon** — quick win for tabs and professionalism  
2. **Guest claim rate limit** — key by `billId`  
3. **Verify prod env checklist** — Convex + Vercel  
4. **Run backfill** on prod if never run  
5. **Custom magic-link email** (optional branding)  
6. **E2E in CI** or mandatory pre-release manual E2E  
7. **Sentry DSN** on Vercel (optional observability)  
8. **Manifest `id`**, OG image dimensions (polish)

---

## Out of scope for this audit

- Penetration test of Convex platform itself
- GDPR/legal/compliance review
- Load testing at scale
- Full marketing SEO (Option C — deferred)

---

## Success criteria for “100% confident”

1. All 🔴 items resolved or explicitly waived  
2. Prod env checklist signed off  
3. Production smoke test completed once on custom domain  
4. Join link preview verified in WhatsApp/Telegram/Facebook debugger  
5. Favicon visible in browser tab  
6. No `DEV_MODE` on prod; magic links use custom domain
