# Production Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden Онова за сметката for a single public production launch — security, privacy, reliability, PWA, tests, CI, and observability.

**Architecture:** Backend-first: guest assignment mutations require host auth OR valid guest session token; `getForGuest` returns minimal data; rate limits on abuse-prone endpoints. Frontend adds 404, error/retry UI, mutation toasts, offline banner, Sentry. PWA icons committed with preflight gate. Playwright covers three critical paths.

**Tech Stack:** Convex, TanStack Start/Router, React 19, Vitest, Playwright, Sentry, Resend, Netlify, pnpm

**Spec:** `docs/superpowers/specs/2026-07-08-production-launch-design.md`

---

## File Map

| File                                           | Responsibility                                              |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `convex/lib/requireGuestSession.ts`            | Validate guest session token (reuse TTL logic)              |
| `convex/lib/assertCanMutateAssignment.ts`      | Host owner OR guest session                                 |
| `convex/assignments.ts`                        | Add `sessionToken` arg; call assert helper                  |
| `convex/lib/devMode.ts`                        | Prod-safe `isDevModeEnabled()`                              |
| `convex/auth.ts`                               | Gate Password provider on `isDevModeEnabled()`              |
| `convex/lib/rateLimit.ts`                      | `assertRateLimit` helper                                    |
| `convex/schema.ts`                             | `rateLimitBuckets` table; `itemAssignments.by_billId` index |
| `convex/bills.ts`                              | Trim `getForGuest`; optimize `loadBillRelations`            |
| `convex/guestSessions.ts`                      | Rate limit on `claim`                                       |
| `convex/receiptScan.ts`                        | Rate limit on scan start                                    |
| `convex/lib/requireGuestSession.test.ts`       | Pure/helper tests where possible                            |
| `convex/lib/assertCanMutateAssignment.test.ts` | Auth logic tests                                            |
| `convex/lib/devMode.test.ts`                   | Extend prod guard tests                                     |
| `src/components/bills/guest-item-row.tsx`      | Pass `sessionToken` to mutations                            |
| `src/components/bills/guest-claim-footer.tsx`  | Pass `sessionToken` to mutations                            |
| `src/routes/bills/$billId/claim.tsx`           | `getForGuest` args; `myPayments`; assignment map memo       |
| `src/routes/bills/$billId/join.tsx`            | `getForGuest` args if needed                                |
| `src/routes/$.tsx`                             | 404 page                                                    |
| `src/hooks/use-online-status.ts`               | Online/offline state                                        |
| `src/components/layout/offline-banner.tsx`     | Dismissible offline banner                                  |
| `src/hooks/use-convex-query-status.ts`         | Loading / notFound / error wrapper                          |
| `src/components/ui/query-error-panel.tsx`      | Retry UI                                                    |
| `src/components/pwa-install-banner.tsx`        | Optional install prompt                                     |
| `scripts/check-pwa-icons.mjs`                  | Fail preflight if PNGs missing                              |
| `scripts/generate-pwa-icons.mjs`               | Existing icon generator                                     |
| `public/icon-192.png` etc.                     | Committed PWA assets                                        |
| `playwright.config.ts`                         | E2E config                                                  |
| `e2e/*.spec.ts`                                | Three critical paths                                        |
| `src/routes/__root.tsx`                        | Sentry init (prod), offline banner                          |
| `.github/workflows/ci.yml`                     | lint + check + preflight                                    |
| `docs/DEPLOY.md`                               | Security notes, Resend, Sentry, smoke                       |
| `.env.example`                                 | `VITE_SENTRY_DSN`, Resend from-address                      |
| `README.md`                                    | pnpm + links                                                |

---

### Task 1: `requireGuestSession` helper

**Files:**

- Create: `convex/lib/requireGuestSession.ts`
- Modify: `convex/guestSessions.ts` (optional refactor to call helper from heartbeat)

- [ ] **Step 1: Create helper**

```typescript
// convex/lib/requireGuestSession.ts
import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { isGuestSessionActive } from './guestSession'

export async function requireGuestSession(
  ctx: MutationCtx | QueryCtx,
  args: {
    billId: Id<'bills'>
    participantId: Id<'participants'>
    sessionToken: string
  },
): Promise<void> {
  const participant = await ctx.db.get(args.participantId)
  if (!participant || participant.billId !== args.billId) {
    throw new ConvexError('Участникът не принадлежи на тази сметка.')
  }

  const session = await ctx.db
    .query('guestSessions')
    .withIndex('by_sessionToken', (q) =>
      q.eq('sessionToken', args.sessionToken),
    )
    .first()

  if (
    !session ||
    session.billId !== args.billId ||
    session.participantId !== args.participantId
  ) {
    throw new ConvexError('Сесията изтече. Изберете името си отново.')
  }

  if (!isGuestSessionActive(session.lastSeenAt)) {
    if ('delete' in ctx.db) {
      await ctx.db.delete(session._id)
    }
    throw new ConvexError('Сесията изтече. Изберете името си отново.')
  }
}
```

- [ ] **Step 2: Refactor `guestSessions.heartbeat` to call `requireGuestSession` then patch `lastSeenAt`** (DRY; keep behavior identical)

- [ ] **Step 3: Run tests**

```bash
pnpm run test
```

Expected: PASS (no regressions)

- [ ] **Step 4: Commit**

```bash
git add convex/lib/requireGuestSession.ts convex/guestSessions.ts
git commit -m "feat: add requireGuestSession helper for guest auth"
```

---

### Task 2: `assertCanMutateAssignment` + wire assignments

**Files:**

- Create: `convex/lib/assertCanMutateAssignment.ts`
- Modify: `convex/assignments.ts`

- [ ] **Step 1: Create assert helper**

```typescript
// convex/lib/assertCanMutateAssignment.ts
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { getAuthUserId } from '@convex-dev/auth/server'
import { assertBillOwnedBy } from './bill_ownership'
import { requireGuestSession } from './requireGuestSession'

export async function assertCanMutateAssignment(
  ctx: MutationCtx,
  args: {
    billId: Id<'bills'>
    participantId: Id<'participants'>
    sessionToken?: string
  },
): Promise<void> {
  const userId = await getAuthUserId(ctx)
  if (userId !== null) {
    const bill = await ctx.db.get(args.billId)
    if (bill?.ownerId) {
      assertBillOwnedBy(bill, userId)
      return
    }
  }

  if (!args.sessionToken) {
    throw new ConvexError('Изисква се валидна гост-сесия.')
  }

  await requireGuestSession(ctx, {
    billId: args.billId,
    participantId: args.participantId,
    sessionToken: args.sessionToken,
  })
}
```

Add missing import: `import { ConvexError } from 'convex/values'`

- [ ] **Step 2: Update `assignments.toggle` and `assignments.setUnits`**

Add to args: `sessionToken: v.optional(v.string())`

After loading `item` and before `assertAssignmentEditable`:

```typescript
await assertCanMutateAssignment(ctx, {
  billId: item.billId,
  participantId: args.participantId,
  sessionToken: args.sessionToken,
})
```

- [ ] **Step 3: Update guest components to pass token**

`src/components/bills/guest-item-row.tsx` — add prop `sessionToken: string`, pass to both mutations:

```typescript
await toggleAssignment({ itemId: item._id, participantId, sessionToken })
await setUnits({ itemId: item._id, participantId, units, sessionToken })
```

`src/components/bills/guest-claim-footer.tsx` — same for `handleRemoveItem`.

`src/routes/bills/$billId/claim.tsx` — pass `storedSession.sessionToken` into `GuestItemRow` and `GuestClaimFooter`.

Host `assignment-row.tsx` — no change (no sessionToken; owner auth path).

- [ ] **Step 4: Manual verify**

1. Guest claim without session in Convex dashboard → should fail
2. Host assignment row still works when logged in

- [ ] **Step 5: Commit**

```bash
git add convex/lib/assertCanMutateAssignment.ts convex/assignments.ts src/components/bills/guest-item-row.tsx src/components/bills/guest-claim-footer.tsx src/routes/bills/$billId/claim.tsx
git commit -m "feat: require guest session or host auth for assignment mutations"
```

---

### Task 3: DEV_MODE production guard

**Files:**

- Modify: `convex/lib/devMode.ts`
- Modify: `convex/auth.ts`
- Modify: `convex/lib/devMode.test.ts`

- [ ] **Step 1: Replace `isDevMode` with guarded helper**

```typescript
// convex/lib/devMode.ts
export function isDevModeEnabled(): boolean {
  if (process.env.DEV_MODE !== 'true') return false
  const deployment = process.env.CONVEX_DEPLOYMENT ?? ''
  // Allow only on dev deployments (name contains "dev" or ends with dev team slug pattern)
  return deployment.includes('dev') || deployment.endsWith('-dev')
}

/** @deprecated use isDevModeEnabled */
export function isDevMode(): boolean {
  return isDevModeEnabled()
}
```

Adjust `deployment.includes('dev')` to match your actual dev deployment name if different (document in DEPLOY.md).

- [ ] **Step 2: Gate Password provider in `convex/auth.ts`**

Replace `isDevMode()` checks with `isDevModeEnabled()`.

- [ ] **Step 3: Extend tests**

```typescript
// convex/lib/devMode.test.ts
it('returns false when DEV_MODE=true on prod-like deployment', () => {
  vi.stubEnv('DEV_MODE', 'true')
  vi.stubEnv('CONVEX_DEPLOYMENT', 'coordinated-warbler-782')
  expect(isDevModeEnabled()).toBe(false)
})
```

- [ ] **Step 4: Run tests and commit**

```bash
pnpm run test convex/lib/devMode.test.ts
git add convex/lib/devMode.ts convex/auth.ts convex/lib/devMode.test.ts
git commit -m "fix: prevent DEV_MODE auth on production deployments"
```

---

### Task 4: Rate limiting

**Files:**

- Modify: `convex/schema.ts`
- Create: `convex/lib/rateLimit.ts`
- Modify: `convex/guestSessions.ts`
- Modify: `convex/receiptScan.ts` (or action entry mutation)

- [ ] **Step 1: Add schema table + index on itemAssignments**

```typescript
rateLimitBuckets: defineTable({
  key: v.string(),
  windowStart: v.number(),
  count: v.number(),
}).index('by_key', ['key']),

// itemAssignments — add:
.index('by_billId', ['billId']) // requires billId field — see Step 1b
```

**Step 1b:** Add `billId: v.id('bills')` to `itemAssignments` schema (denormalized). Backfill in migration mutation or one-time script; new inserts set `billId` from item. Update all `insert` paths in `assignments.ts`.

- [ ] **Step 2: Create rate limit helper**

```typescript
// convex/lib/rateLimit.ts
import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'

export async function assertRateLimit(
  ctx: MutationCtx,
  key: string,
  max: number,
  windowMs: number,
  message = 'Твърде много заявки. Опитайте отново след малко.',
): Promise<void> {
  const now = Date.now()
  const existing = await ctx.db
    .query('rateLimitBuckets')
    .withIndex('by_key', (q) => q.eq('key', key))
    .first()

  if (!existing || now - existing.windowStart >= windowMs) {
    if (existing) await ctx.db.delete(existing._id)
    await ctx.db.insert('rateLimitBuckets', { key, windowStart: now, count: 1 })
    return
  }

  if (existing.count >= max) {
    throw new ConvexError(message)
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 })
}
```

- [ ] **Step 3: Wire limits**

`guestSessions.claim` — start of handler:

```typescript
await assertRateLimit(ctx, `claim:${args.sessionToken}`, 20, 60_000)
```

Receipt scan — in mutation that schedules action (10/hour per bill):

```typescript
await assertRateLimit(ctx, `ocr:${args.billId}`, 10, 3_600_000)
```

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/lib/rateLimit.ts convex/guestSessions.ts convex/receiptScan.ts convex/assignments.ts
git commit -m "feat: add rate limits for guest claim and OCR scan"
```

---

### Task 5: Trim `getForGuest` privacy

**Files:**

- Modify: `convex/bills.ts`
- Modify: `src/routes/bills/$billId/claim.tsx`
- Modify: `src/routes/bills/$billId/join.tsx` (if uses payments)

- [ ] **Step 1: Change query args and return shape**

```typescript
export const getForGuest = query({
  args: {
    billId: v.id('bills'),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.billId)
    if (!bill?.ownerId) return null

    const { participants, items, assignments, payments } =
      await loadBillRelations(ctx, args.billId)

    let myPayments: typeof payments = []
    if (args.sessionToken) {
      const session = await ctx.db
        .query('guestSessions')
        .withIndex('by_sessionToken', (q) =>
          q.eq('sessionToken', args.sessionToken!),
        )
        .first()
      if (
        session &&
        session.billId === args.billId &&
        isGuestSessionActive(session.lastSeenAt)
      ) {
        myPayments = payments.filter(
          (p) => p.participantId === session.participantId,
        )
      }
    }

    return { bill, participants, items, assignments, myPayments }
  },
})
```

- [ ] **Step 2: Update `claim.tsx`**

```typescript
const data = useQuery(api.bills.getForGuest, {
  billId,
  sessionToken: storedSession?.sessionToken,
})

// In calculateBillTotals:
payments: data.myPayments.map((p) => ({
  participantId: p.participantId,
  amountCents: p.amountCents,
})),
```

- [ ] **Step 3: Grep for `getForGuest` and update all call sites**

```bash
rg "getForGuest" src convex
```

- [ ] **Step 4: Commit**

```bash
git add convex/bills.ts src/routes/bills/$billId/claim.tsx src/routes/bills/$billId/join.tsx
git commit -m "fix: stop exposing all guest payments in getForGuest"
```

---

### Task 6: Optimize `loadBillRelations` (N+1 fix)

**Files:**

- Modify: `convex/bills.ts`
- Modify: `convex/schema.ts` (if `billId` on assignments from Task 4)

- [ ] **Step 1: Load assignments via `by_billId` index**

```typescript
const assignments = await ctx.db
  .query('itemAssignments')
  .withIndex('by_billId', (q) => q.eq('billId', billId))
  .collect()
```

Remove per-item Promise.all loop.

- [ ] **Step 2: Verify host/guest pages still load assignments correctly**

- [ ] **Step 3: Commit**

```bash
git add convex/bills.ts convex/schema.ts convex/assignments.ts
git commit -m "perf: load bill assignments in single query"
```

---

### Task 7: Convex security tests

**Files:**

- Create: `convex/lib/assertCanMutateAssignment.test.ts` (unit tests with mocked ctx if needed)
- Create: `src/lib/get-for-guest-shape.test.ts` (type-level or document contract test)

For assignment auth, add integration-style tests using existing patterns in `convex/lib/bill_ownership.test.ts`:

- [ ] **Step 1: Test `isDevModeEnabled` prod guard** (Task 3)

- [ ] **Step 2: Add test documenting `getForGuest` must not expose `payments` key**

```typescript
// src/lib/get-for-guest-shape.test.ts
import { describe, expect, it } from 'vitest'

describe('getForGuest contract', () => {
  it('uses myPayments not payments', () => {
    const allowedKeys = [
      'bill',
      'participants',
      'items',
      'assignments',
      'myPayments',
    ]
    expect(allowedKeys).not.toContain('payments')
  })
})
```

- [ ] **Step 3: Manual security check** (document in DEPLOY.md)

Call `assignments.toggle` from Convex dashboard without `sessionToken` on draft bill → must throw.

- [ ] **Step 4: Commit**

```bash
git add convex/lib/devMode.test.ts src/lib/get-for-guest-shape.test.ts
git commit -m "test: add production launch security contract tests"
```

---

### Task 8: 404 route

**Files:**

- Create: `src/routes/$.tsx`

- [ ] **Step 1: Add catch-all route**

```tsx
import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'

export const Route = createFileRoute('/$')({
  component: NotFoundPage,
})

function NotFoundPage() {
  return (
    <div className="page-container flex min-h-[60dvh] flex-col items-center justify-center gap-4 py-10 text-center">
      <h1 className="text-lg font-semibold">Страницата не е намерена</h1>
      <p className="text-sm text-muted-foreground">
        Проверете адреса или се върнете към началото.
      </p>
      <Button asChild className="h-11">
        <Link to="/">Към началото</Link>
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Regenerate routes**

```bash
pnpm run generate-routes
```

- [ ] **Step 3: Verify `/nonexistent` shows 404 page**

- [ ] **Step 4: Commit**

```bash
git add src/routes/$.tsx src/routeTree.gen.ts
git commit -m "feat: add 404 not found page"
```

---

### Task 9: Query error UI + offline banner

**Files:**

- Create: `src/hooks/use-online-status.ts`
- Create: `src/components/layout/offline-banner.tsx`
- Create: `src/components/ui/query-error-panel.tsx`
- Modify: `src/routes/__root.tsx`
- Modify: `src/routes/bills/$billId/join.tsx`, `claim.tsx`

- [ ] **Step 1: `useOnlineStatus` hook**

```typescript
import { useEffect, useState } from 'react'

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])
  return online
}
```

- [ ] **Step 2: Offline banner component** — fixed below header, dismissible per session, copy: „Няма интернет връзка. Приложението изисква мрежа.“

- [ ] **Step 3: Query error panel** — props `{ message?: string; onRetry: () => void }`, button „Опитай отново“

- [ ] **Step 4: In guest routes**, when Convex query errors (use `useQuery` + error boundary or wrap provider error state): show panel instead of infinite loading. Minimal approach: catch in route with local error state if query throws — or use React error boundary around bill content.

- [ ] **Step 5: Mount offline banner in `RootLayout`**

- [ ] **Step 6: Commit**

```bash
git add src/hooks/use-online-status.ts src/components/layout/offline-banner.tsx src/components/ui/query-error-panel.tsx src/routes/__root.tsx src/routes/bills/$billId/join.tsx src/routes/bills/$billId/claim.tsx
git commit -m "feat: add offline banner and query error retry UI"
```

---

### Task 10: Mutation error toasts

**Files:**

- Modify: `src/components/bills/payment-actions.tsx`
- Modify: `src/components/bills/participant-list.tsx`
- Modify: `src/components/bills/item-list.tsx`
- Modify: `src/components/bills/assignment-row.tsx`
- Modify: `src/routes/bills/$billId/index.tsx`

- [ ] **Step 1: For each file**, wrap mutation calls:

```typescript
try {
  await someMutation(args)
} catch (error) {
  toast.error(getConvexErrorMessage(error))
}
```

Import `getConvexErrorMessage` from `#/lib/guest-participant-session.ts` (or extract to shared `convex-error.ts` if preferred).

- [ ] **Step 2: Debounced `updateBill` in bill editor** — catch and toast without breaking debounce queue

- [ ] **Step 3: Commit**

```bash
git add src/components/bills/payment-actions.tsx src/components/bills/participant-list.tsx src/components/bills/item-list.tsx src/components/bills/assignment-row.tsx src/routes/bills/$billId/index.tsx
git commit -m "fix: surface mutation errors with toast feedback"
```

---

### Task 11: PWA icons + preflight gate + install banner

**Files:**

- Create: `scripts/check-pwa-icons.mjs`
- Modify: `package.json`
- Modify: `public/` (generated PNGs)
- Create: `src/components/pwa-install-banner.tsx`
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Generate and commit icons**

```bash
pnpm run generate-icons
git add public/icon-192.png public/icon-512.png public/apple-touch-icon.png
```

- [ ] **Step 2: Create check script**

```javascript
// scripts/check-pwa-icons.mjs
import { accessSync } from 'node:fs'

const required = [
  'public/icon-192.png',
  'public/icon-512.png',
  'public/apple-touch-icon.png',
]

for (const file of required) {
  accessSync(file)
}
console.log('PWA icons OK')
```

- [ ] **Step 3: Update `package.json`**

```json
"preflight": "pnpm run test && node scripts/check-pwa-icons.mjs && pnpm run build",
"check-icons": "node scripts/check-pwa-icons.mjs"
```

- [ ] **Step 4: Install banner on home** — listen `beforeinstallprompt`, show after 2nd visit unless dismissed (`localStorage` key `pwa-install-dismissed`)

- [ ] **Step 5: Commit**

```bash
git add scripts/check-pwa-icons.mjs package.json public/ src/components/pwa-install-banner.tsx src/routes/index.tsx
git commit -m "feat: commit PWA icons, preflight check, install banner"
```

---

### Task 12: Sentry

**Files:**

- Modify: `package.json`
- Modify: `src/routes/__root.tsx`
- Modify: `.env.example`, `docs/DEPLOY.md`

- [ ] **Step 1: Install**

```bash
pnpm add @sentry/react
```

- [ ] **Step 2: Init in `RootDocument` or separate `sentry.client.ts`**

```typescript
import * as Sentry from '@sentry/react'

if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  })
}
```

- [ ] **Step 3: Document `VITE_SENTRY_DSN` in `.env.example` and DEPLOY.md**

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/routes/__root.tsx .env.example docs/DEPLOY.md
git commit -m "feat: add Sentry error tracking for production"
```

---

### Task 13: CI — lint and check

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add steps before preflight**

```yaml
- name: Format check
  run: pnpm run check

- name: Lint
  run: pnpm run lint

- name: Preflight
  run: pnpm run preflight
```

- [ ] **Step 2: Run locally**

```bash
pnpm run check && pnpm run lint && pnpm run preflight
```

Fix any failures.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run prettier check and eslint before preflight"
```

---

### Task 14: Claim page performance memo

**Files:**

- Modify: `src/routes/bills/$billId/claim.tsx`

- [ ] **Step 1: Precompute assignment map**

```typescript
const assignmentsByItemId = useMemo(() => {
  if (!data) return new Map()
  const map = new Map<Id<'items'>, typeof data.assignments>()
  for (const assignment of data.assignments) {
    const list = map.get(assignment.itemId) ?? []
    list.push(assignment)
    map.set(assignment.itemId, list)
  }
  return map
}, [data?.assignments])

// In map:
itemAssignments={assignmentsByItemId.get(item._id) ?? []}
```

- [ ] **Step 2: Add `font-display: swap` to Google Fonts in `src/styles.css`**

- [ ] **Step 3: Commit**

```bash
git add src/routes/bills/$billId/claim.tsx src/styles.css
git commit -m "perf: memoize claim assignments and improve font loading"
```

---

### Task 15: Playwright E2E

**Files:**

- Create: `playwright.config.ts`
- Create: `e2e/happy-split.spec.ts`
- Create: `e2e/session-conflict.spec.ts`
- Create: `e2e/final-readonly.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Config** — baseURL `http://localhost:3000`, viewport `{ width: 390, height: 844 }`, `webServer` command `pnpm run dev`

- [ ] **Step 3: Happy path test** (sketch)

```typescript
// e2e/happy-split.spec.ts
import { test, expect } from '@playwright/test'

test('guest can claim an item', async ({ page, context }) => {
  // Assumes dev auth + seeded bill or creates via UI
  // 1. Host creates bill, adds participant + item
  // 2. Copy join URL, open guest context
  // 3. Select participant, claim item
  // 4. Expect footer total > 0
})
```

Document required env: `VITE_CONVEX_URL`, dev auth enabled for host steps.

- [ ] **Step 4: Add script**

```json
"test:e2e": "playwright test"
```

- [ ] **Step 5: Run locally**

```bash
pnpm run test:e2e
```

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts e2e/ package.json pnpm-lock.yaml
git commit -m "test: add Playwright E2E for critical guest flows"
```

---

### Task 16: Docs and email config

**Files:**

- Modify: `docs/DEPLOY.md`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `convex/auth.ts` (Resend from address via env)

- [ ] **Step 1: Resend from address**

```typescript
Resend({
  from: process.env.AUTH_RESEND_FROM ?? 'Онова за сметката <onboarding@resend.dev>',
}),
```

Document `AUTH_RESEND_FROM` in `.env.example` (Convex prod env).

- [ ] **Step 2: Update DEPLOY.md** with:
  - Security notes (capability URLs, guest session enforcement)
  - Never enable DEV_MODE on prod
  - Sentry DSN setup
  - Resend domain verification
  - Full smoke checklist (existing + security verification steps)

- [ ] **Step 3: Update README** — pnpm commands, links to spec and DEPLOY.md

- [ ] **Step 4: Commit**

```bash
git add docs/DEPLOY.md .env.example README.md convex/auth.ts
git commit -m "docs: production launch runbook and Resend from env"
```

---

### Task 17: Launch smoke (manual gate)

**No code.** Execute before single public deploy:

- [ ] Run full `pnpm run check && pnpm run lint && pnpm run preflight && pnpm run test:e2e`
- [ ] `pnpm run deploy` to staging/prod
- [ ] Complete `docs/DEPLOY.md` smoke checklist on production URL
- [ ] Verify Sentry receives test error
- [ ] Lighthouse PWA: installable + correct icons
- [ ] Penetration check: assignment mutation without session fails
- [ ] Network tab: `getForGuest` has no `payments` field

---

## Spec coverage checklist

| Spec requirement       | Task |
| ---------------------- | ---- |
| Guest assignment auth  | 1, 2 |
| DEV_MODE prod guard    | 3    |
| Rate limits            | 4    |
| Trim guest payments    | 5    |
| N+1 assignments        | 6    |
| Convex tests           | 7    |
| 404                    | 8    |
| Query errors + offline | 9    |
| Mutation toasts        | 10   |
| PWA icons + install    | 11   |
| Sentry                 | 12   |
| CI lint/check          | 13   |
| Claim perf + fonts     | 14   |
| Playwright E2E         | 15   |
| Resend + docs          | 16   |
| Smoke gate             | 17   |

## Out of scope (confirmed)

Service worker, link expiry, i18n, pagination, SSR auth, CAPTCHA — not in this plan.
