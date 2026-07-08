# Production Launch — Design Spec

**Date:** 2026-07-08  
**Project:** onova-za-smetkata (Онова за сметката)  
**Status:** Approved  
**Audience:** Public / open use  
**Launch model:** Single big-bang release (app not public yet)

## Summary

Harden the bill-splitting PWA for a **public production launch**: close guest authorization gaps, trim sensitive guest data, improve reliability and error UX, complete PWA assets, add observability and tests, and expand CI. No new product features — only production readiness.

## Context

The app is feature-complete for core flows (host bill editor, receipt OCR, guest QR join/claim, payments, finalize, share). A production-readiness audit identified:

- Guest assignment mutations callable without session proof (**blocker**)
- PWA PNG icons referenced but not committed (**blocker**)
- `DEV_MODE` can enable Password auth if misconfigured on prod Convex (**blocker**)
- `getForGuest` exposes all participants’ payment records (**important**)
- No 404, weak network-error UX, uneven mutation error handling (**important**)
- Magic links from `onboarding@resend.dev` (**important**)
- Unit tests only; no Convex security or E2E coverage (**important**)

## Decisions

| Decision                  | Choice                                                        |
| ------------------------- | ------------------------------------------------------------- |
| Launch model              | Single deploy when all launch gates pass                      |
| Guest bill access         | Link secrecy (QR/share URL); no link expiry in v1             |
| Guest assignment auth     | Shared mutations; host OR valid guest session                 |
| Guest payments visibility | Omit raw `payments[]`; guest sees only own totals via session |
| Offline                   | Network required; offline **banner** only (no service worker) |
| PWA icons                 | Generate + commit PNGs; verify in CI/preflight                |
| Error tracking            | Sentry on frontend (prod); log OCR action failures            |
| E2E                       | Playwright, mobile viewport, 3 critical paths                 |
| Rate limiting             | Lightweight Convex table; OCR + guest claim v1                |

## Launch gates (definition of done)

All gates must pass before public launch.

| Gate              | Pass criteria                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security**      | Guest assignment mutations require valid session OR host auth; `DEV_MODE` cannot activate on prod deployment; rate limits on OCR scan and guest session claim |
| **Privacy**       | `getForGuest` does not return other participants’ payment records                                                                                             |
| **Reliability**   | 404 route; query error UI with retry; all user-facing mutations show toast on failure                                                                         |
| **PWA**           | `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` in repo; manifest valid; icons generated in preflight                                                  |
| **Email auth**    | Magic links from verified Resend domain (not `onboarding@resend.dev`)                                                                                         |
| **Testing**       | Convex tests for assignment auth + guest query shape; Playwright E2E for 3 paths                                                                              |
| **CI**            | `lint` + `check` + `preflight` on every PR                                                                                                                    |
| **Observability** | Sentry initialized in production builds                                                                                                                       |
| **Ops**           | `DEPLOY.md` smoke checklist executed once on production URL                                                                                                   |

---

## Architecture

### Authorization model (assignments)

Today: `assignments.toggle` / `assignments.setUnits` validate bill status and participant ownership only.

Target:

```
assertCanMutateAssignment(ctx, { billId, participantId, sessionToken? })
  ├─ if authenticated user owns bill → allow (host editor)
  └─ else requireGuestSession(ctx, { billId, participantId, sessionToken })
       └─ token exists, matches bill + participant, not expired
```

**Guest callers** (`guest-item-row.tsx`, `guest-claim-footer.tsx`) pass `sessionToken` from `getStoredGuestSession(billId)`.

**Host callers** (`assignment-row.tsx`) unchanged — Convex Auth satisfies owner check.

Shared helper lives in `convex/lib/requireGuestSession.ts` (reuse logic from `guestSessions.heartbeat`).

### Guest data surface (`getForGuest`)

**Remove:** full `payments[]` array.

**Keep:** bill, participants, items, assignments (needed for claim UI).

**Add (optional args):** `sessionToken?: string`. When provided and valid, response may include **only** the requesting participant’s computed payment summary (`paidCents`, `status`) for footer display — not other guests’ payments.

For **final** bills, keep read-only guest access without strict session on query (join/claim UX unchanged); payment details for others remain hidden.

### Rate limiting (v1)

New table `rateLimitBuckets`:

| Field       | Type   | Notes                                   |
| ----------- | ------ | --------------------------------------- |
| key         | string | e.g. `ocr:billId`, `claim:sessionToken` |
| windowStart | number | ms epoch                                |
| count       | number | events in window                        |

Helper `assertRateLimit(ctx, key, max, windowMs)` — increment or throw `ConvexError` with Bulgarian message.

| Endpoint                 | Limit               | Window   |
| ------------------------ | ------------------- | -------- |
| Receipt OCR action start | 10 per bill         | 1 hour   |
| `guestSessions.claim`    | 20 per sessionToken | 1 minute |

Host auth sign-in: rely on Convex Auth + Resend provider limits; document in DEPLOY.md.

### DEV_MODE guard

In `convex/lib/devMode.ts`:

- `isDevModeEnabled()` returns true only when `DEV_MODE === 'true'` **and** deployment URL/name indicates dev (e.g. `CONVEX_DEPLOYMENT` contains `-dev` or matches dev deployment name from env).
- `convex/auth.ts` Password provider gated on this function.
- Unit test: prod-like env → false even if `DEV_MODE=true`.

---

## Frontend reliability

### 404

Add catch-all route `src/routes/$.tsx` (or `notFoundComponent` on router):

- Bulgarian copy: page not found
- Link to `/`

### Query errors

Introduce `useQueryResult(query)` or per-route pattern:

- `undefined` → loading (skeleton where already implemented)
- `null` → not found (existing)
- thrown / error state → banner with **„Опитай отново“** retry (refetch)

Apply to guest routes first (`join`, `claim`), then host bill routes.

### Mutation errors

Wrap in try/catch + `toast.error(getConvexErrorMessage(error))`:

| File                      | Mutations              |
| ------------------------- | ---------------------- |
| `payment-actions.tsx`     | mark paid / partial    |
| `participant-list.tsx`    | add, remove            |
| `item-list.tsx`           | add item               |
| `assignment-row.tsx`      | toggle, setUnits       |
| `bills/$billId/index.tsx` | debounced `updateBill` |

### Offline banner

- Hook `useOnlineStatus()` → `navigator.onLine` + `online`/`offline` events
- Fixed dismissible banner below header when offline
- No queued writes; copy explains network is required

---

## PWA & mobile

1. Run `pnpm run generate-icons`; commit outputs to `public/`.
2. Add icon check to `preflight`: fail if `public/icon-192.png`, `public/icon-512.png`, or `public/apple-touch-icon.png` are missing (small Node script or shell check).
3. Verify `manifest.json` icons resolve on Netlify.
4. **Install prompt (in scope):** capture `beforeinstallprompt` on home; show one-time dismissible banner after second visit (`localStorage` key `pwa-install-dismissed`).

**Out of scope:** service worker, offline cache, background sync.

---

## Testing

### Convex (Vitest or convex-test)

| Test                                               | Asserts                   |
| -------------------------------------------------- | ------------------------- |
| `assignments.toggle` without session on draft bill | throws                    |
| `assignments.toggle` with valid guest session      | succeeds                  |
| `assignments.toggle` as bill owner (mock auth)     | succeeds                  |
| `getForGuest` response                             | no `payments` array       |
| `isDevModeEnabled`                                 | false on prod-like config |

### Playwright E2E (mobile viewport 390×844)

| Path             | Steps                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| Happy split      | Host dev login → create bill → add participant + item → open join URL → claim item → verify footer total |
| Session conflict | Two contexts claim same participant name on draft bill → second sees error                               |
| Final read-only  | Host finalizes → guest claim page shows read-only, no assignment changes                                 |

E2E uses test Convex deployment or documented seed; run in CI optionally (may start as local-only if Convex test env setup is heavy — document in plan).

---

## CI/CD & observability

### CI (`.github/workflows/ci.yml`)

```yaml
- pnpm run check # prettier
- pnpm run lint
- pnpm run preflight # test + build (+ icon check)
```

### Sentry

- Add `@sentry/react` (prod only in `__root.tsx`)
- `VITE_SENTRY_DSN` in Netlify env
- `Sentry.init({ environment, tracesSampleRate: 0.1 })`
- Optional: wrap OCR action errors with structured log

### Email

- Verify domain in Resend
- Set production from-address via Convex Auth env (replace `onboarding@resend.dev`)
- Update `.env.example` and `DEPLOY.md`

### README

- Use `pnpm` commands consistently
- Link to this spec and `DEPLOY.md`

---

## Performance (pre-launch)

| Item            | Change                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------- |
| N+1 assignments | Add `itemAssignments.by_billId` index; load assignments in one query in `loadBillRelations` |
| Claim page      | Precompute `assignmentsByItemId` map in `useMemo`; avoid filter inside `.map()`             |
| Fonts           | Add `font-display: swap` on Google Fonts import (or defer self-hosting)                     |

---

## Security & privacy notes (document in DEPLOY.md)

- Bill links are capability URLs — anyone with link can read bill on guest routes.
- Guest session locks identity on draft bills; backend enforcement is required (this spec).
- IBAN never exposed to guests (`getForGuest` payment settings already safe).
- Never set `DEV_MODE=true` on production Convex deployment.

---

## Out of scope (v1)

- Bill link expiry / revocation
- Full offline PWA / service worker
- i18n beyond Bulgarian
- Pagination on home bill list
- SSR auth
- LogRocket / session replay
- CAPTCHA on guest join

---

## Success criteria

1. Penetration-style check: calling `assignments.toggle` with wrong `participantId` and no session fails.
2. Guest network tab: `getForGuest` response has no other users’ payment rows.
3. Lighthouse PWA audit: installable with correct icons.
4. Playwright happy path green locally.
5. Sentry receives a test error from staging/prod.
6. Full `DEPLOY.md` smoke checklist passes on production URL.

---

## Files (primary)

| Area         | Files                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| Guest auth   | `convex/lib/requireGuestSession.ts`, `convex/lib/assertCanMutateAssignment.ts`, `convex/assignments.ts`         |
| Guest query  | `convex/bills.ts` (`getForGuest`), `claim.tsx`, `join.tsx`                                                      |
| DEV guard    | `convex/lib/devMode.ts`, `convex/auth.ts`, tests                                                                |
| Rate limit   | `convex/schema.ts`, `convex/lib/rateLimit.ts`, `receiptScan.ts`, `guestSessions.ts`                             |
| 404 / errors | `src/routes/$.tsx`, `src/router.tsx`, query error hook                                                          |
| Mutations UX | `payment-actions.tsx`, `participant-list.tsx`, `item-list.tsx`, `assignment-row.tsx`, `bills/$billId/index.tsx` |
| Offline      | new `use-online-status.ts`, banner in `__root.tsx` or layout                                                    |
| PWA          | `scripts/generate-pwa-icons.mjs`, `public/*`, `package.json` preflight                                          |
| Sentry       | `__root.tsx`, `.env.example`, `DEPLOY.md`                                                                       |
| CI           | `.github/workflows/ci.yml`                                                                                      |
| E2E          | `e2e/` + Playwright config                                                                                      |
| Tests        | `convex/**/*.test.ts` or `src/**/*.test.ts` for auth helpers                                                    |
| Docs         | `DEPLOY.md`, `README.md`                                                                                        |

---

## Estimated effort

| Workstream                       | Days (focused) |
| -------------------------------- | -------------- |
| Security + privacy + rate limits | 3–4            |
| Reliability UX                   | 2              |
| PWA + icons                      | 0.5            |
| Convex + E2E tests               | 3–4            |
| CI + Sentry + email              | 1–2            |
| Performance                      | 1              |
| Smoke + deploy                   | 0.5            |
| **Total**                        | **~2–3 weeks** |

---

## Implementation order

1. Security backend (guest session on assignments, DEV guard, rate limits)
2. Trim `getForGuest` + update guest clients
3. Convex tests for above
4. Frontend reliability (404, errors, offline banner, mutation toasts)
5. PWA icons + preflight gate
6. Sentry + Resend prod email + CI lint
7. Playwright E2E
8. Performance quick wins
9. Full smoke on staging → single production deploy
