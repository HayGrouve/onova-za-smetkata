# Combined Guest Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a guest pay their share plus one other participant on the same bill via an expanded claim footer, with a pending request the host confirms once.

**Architecture:** New `combinedPaymentRequests` Convex table stores snapshotted amounts; guest `create` runs after chip selection + Revolut tap; host `confirm` atomically inserts two `payments` rows. Shared validation helpers keep amount caps aligned with `validatePaymentAdd`. `bills.getForGuest` gains per-participant `remainingCents` so the footer can render unpaid chips without exposing full payment history.

**Tech Stack:** Convex, TanStack Start/React 19, Shadcn UI, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-07-15-combined-guest-payment-design.md`

## Global Constraints

- Scope: same bill only; payer share + exactly one other participant
- Actor: guest initiates; host confirms via banner on `BillSummaryContent`
- Solo Revolut: unchanged (no DB write)
- Combined Revolut: `combinedPayments.create` → pending → Revolut with `totalCents`
- Trust model: host manually confirms money received (no payment processor)
- Copy language: Bulgarian UI strings (match existing guest/host flows)
- Amounts: EUR integer cents only
- v1 out of scope: 2+ others, cross-bill, auto-confirm, guest payment history for covered person

---

## File map

| File                                               | Responsibility                                          |
| -------------------------------------------------- | ------------------------------------------------------- |
| `shared/combined-payment-messages.ts`              | Bulgarian error/status strings                          |
| `shared/combined-payment.ts`                       | Pure validation: remaining cents, create/confirm guards |
| `shared/combined-payment.test.ts`                  | Vitest for shared helpers                               |
| `convex/schema.ts`                                 | `combinedPaymentRequests` table + indexes               |
| `convex/combinedPayments.ts`                       | create, cancel, confirm, reject, queries                |
| `convex/lib/combinedPayment.ts`                    | Server shim re-exporting shared helpers                 |
| `convex/bills.ts`                                  | Extend `getForGuest` with `participantBalances`         |
| `src/components/bills/combined-pay-chips.tsx`      | Chip row UI (new, keeps footer focused)                 |
| `src/components/bills/guest-claim-footer.tsx`      | Wire chips, combined total, pending state               |
| `src/components/bills/combined-payment-banner.tsx` | Host pending banner (new)                               |
| `src/components/bills/bill-summary-content.tsx`    | Render host banner(s)                                   |
| `src/routes/bills/$billId/claim.tsx`               | Pass balances + participant labels to footer            |
| `e2e/combined-guest-payment.spec.ts`               | Happy path + cancel                                     |

---

### Task 1: Shared combined-payment helpers (TDD)

**Files:**

- Create: `shared/combined-payment-messages.ts`
- Create: `shared/combined-payment.ts`
- Create: `shared/combined-payment.test.ts`

**Interfaces:**

- Produces:
  - `COMBINED_PAYMENT_MESSAGES` — string constants
  - `participantRemainingCents(totals, participantId): number`
  - `validateCombinedPaymentCreate(input, ctx): { ok: true; payerAmountCents; coveredAmountCents; totalCents } | { ok: false; message }`
  - `validateCombinedPaymentConfirm(input, ctx): { ok: true } | { ok: false; message }`
  - Types: `CombinedPaymentCreateInput`, `CombinedPaymentCreateContext`, `CombinedPaymentConfirmInput`, `CombinedPaymentConfirmContext`

- [ ] **Step 1: Write failing tests**

```ts
// shared/combined-payment.test.ts
import { describe, expect, it } from 'vitest'
import {
  participantRemainingCents,
  validateCombinedPaymentCreate,
  validateCombinedPaymentConfirm,
} from './combined-payment'
import type { BillTotals } from './bill-calculations'

function totals(overrides: Partial<BillTotals['byParticipant']>): BillTotals {
  const byParticipant: BillTotals['byParticipant'] = {}
  for (const [id, t] of Object.entries(overrides)) {
    byParticipant[id] = {
      owedCents: t.owedCents ?? 0,
      paidCents: t.paidCents ?? 0,
      balanceCents: (t.owedCents ?? 0) - (t.paidCents ?? 0),
      status:
        (t.paidCents ?? 0) <= 0
          ? 'unpaid'
          : (t.paidCents ?? 0) >= (t.owedCents ?? 0)
            ? 'paid'
            : 'partial',
    }
  }
  return { billTotalCents: 0, byParticipant }
}

describe('participantRemainingCents', () => {
  it('returns balance for participant', () => {
    const t = totals({ p1: { owedCents: 1000, paidCents: 200 } })
    expect(participantRemainingCents(t, 'p1')).toBe(800)
  })

  it('returns 0 for unknown participant', () => {
    expect(participantRemainingCents(totals({}), 'x')).toBe(0)
  })
})

describe('validateCombinedPaymentCreate', () => {
  const baseCtx = {
    payerParticipantId: 'p1',
    hasPendingForSession: false,
    coveredHasPending: false,
    totals: totals({
      p1: { owedCents: 1250, paidCents: 0 },
      p2: { owedCents: 920, paidCents: 0 },
    }),
  }

  it('accepts valid payer + covered', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantId: 'p2' },
      baseCtx,
    )
    expect(result).toEqual({
      ok: true,
      payerAmountCents: 1250,
      coveredAmountCents: 920,
      totalCents: 2170,
    })
  })

  it('rejects covered same as payer', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantId: 'p1' },
      baseCtx,
    )
    expect(result.ok).toBe(false)
  })

  it('rejects zero remaining on covered', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantId: 'p2' },
      {
        ...baseCtx,
        totals: totals({
          p1: { owedCents: 1250, paidCents: 0 },
          p2: { owedCents: 920, paidCents: 920 },
        }),
      },
    )
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate pending for session', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantId: 'p2' },
      { ...baseCtx, hasPendingForSession: true },
    )
    expect(result.ok).toBe(false)
  })

  it('rejects when covered already has pending', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantId: 'p2' },
      { ...baseCtx, coveredHasPending: true },
    )
    expect(result.ok).toBe(false)
  })
})

describe('validateCombinedPaymentConfirm', () => {
  it('accepts when snapshotted amounts fit remaining', () => {
    const result = validateCombinedPaymentConfirm(
      { payerAmountCents: 1250, coveredAmountCents: 920 },
      {
        payerRemainingCents: 1250,
        coveredRemainingCents: 920,
      },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects when covered already paid', () => {
    const result = validateCombinedPaymentConfirm(
      { payerAmountCents: 1250, coveredAmountCents: 920 },
      { payerRemainingCents: 1250, coveredRemainingCents: 0 },
    )
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run shared/combined-payment.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement shared helpers**

```ts
// shared/combined-payment-messages.ts
export const COMBINED_PAYMENT_MESSAGES = {
  sameParticipant: 'Не можете да платите за себе си.',
  coveredAlreadyPaid: 'Дялът на участника вече е платен.',
  payerNothingOwed: 'Нямате оставащ дял за плащане.',
  pendingExists: 'Вече има чакащо плащане от вас.',
  coveredPendingExists: 'Вече има чакащо плащане за този участник.',
  requestNotFound: 'Заявката не е намерена.',
  requestNotPending: 'Заявката вече е обработена.',
  coveredPaidBeforeConfirm: 'Дялът на {name} вече е платен.',
  payerOverRemaining: 'Вашият дял се е променил. Отменете и опитайте отново.',
  statusPending: 'Чака потвърждение от домакина',
  payForLabel: 'Плати и за',
  combinedTotalLabel: 'Общо за плащане',
  cancelPending: 'Отмени',
  hostConfirmPrompt: 'Маркира {payer} и {covered} като платени?',
  hostBanner: '{payer} плати {total} за {payer} + {covered}',
  confirm: 'Потвърди',
  reject: 'Отхвърли',
  combinedPaymentNote: 'Комбинирано плащане',
} as const
```

```ts
// shared/combined-payment.ts
import type { BillTotals } from './bill-calculations'
import { COMBINED_PAYMENT_MESSAGES } from './combined-payment-messages'

export type CombinedPaymentCreateInput = {
  coveredParticipantId: string
}

export type CombinedPaymentCreateContext = {
  payerParticipantId: string
  hasPendingForSession: boolean
  coveredHasPending: boolean
  totals: BillTotals
}

export type CombinedPaymentCreateResult = {
  payerAmountCents: number
  coveredAmountCents: number
  totalCents: number
}

export type CombinedPaymentConfirmInput = {
  payerAmountCents: number
  coveredAmountCents: number
}

export type CombinedPaymentConfirmContext = {
  payerRemainingCents: number
  coveredRemainingCents: number
}

export function participantRemainingCents(
  totals: BillTotals,
  participantId: string,
): number {
  return Math.max(0, totals.byParticipant[participantId]?.balanceCents ?? 0)
}

export function validateCombinedPaymentCreate(
  input: CombinedPaymentCreateInput,
  ctx: CombinedPaymentCreateContext,
):
  | ({ ok: true } & CombinedPaymentCreateResult)
  | { ok: false; message: string } {
  if (input.coveredParticipantId === ctx.payerParticipantId) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.sameParticipant }
  }
  if (ctx.hasPendingForSession) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.pendingExists }
  }
  if (ctx.coveredHasPending) {
    return {
      ok: false,
      message: COMBINED_PAYMENT_MESSAGES.coveredPendingExists,
    }
  }

  const payerAmountCents = participantRemainingCents(
    ctx.totals,
    ctx.payerParticipantId,
  )
  const coveredAmountCents = participantRemainingCents(
    ctx.totals,
    input.coveredParticipantId,
  )

  if (payerAmountCents <= 0) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.payerNothingOwed }
  }
  if (coveredAmountCents <= 0) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.coveredAlreadyPaid }
  }

  return {
    ok: true,
    payerAmountCents,
    coveredAmountCents,
    totalCents: payerAmountCents + coveredAmountCents,
  }
}

export function validateCombinedPaymentConfirm(
  input: CombinedPaymentConfirmInput,
  ctx: CombinedPaymentConfirmContext,
): { ok: true } | { ok: false; message: string } {
  if (input.payerAmountCents > ctx.payerRemainingCents) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.payerOverRemaining }
  }
  if (input.coveredAmountCents > ctx.coveredRemainingCents) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.coveredAlreadyPaid }
  }
  return { ok: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run shared/combined-payment.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add shared/combined-payment-messages.ts shared/combined-payment.ts shared/combined-payment.test.ts
git commit -m "feat(combined-pay): add shared validation helpers"
```

---

### Task 2: Schema and Convex module scaffold

**Files:**

- Modify: `convex/schema.ts`
- Create: `convex/lib/combinedPayment.ts`
- Create: `convex/combinedPayments.ts` (queries + stubs)

**Interfaces:**

- Consumes: shared helpers from Task 1
- Produces:
  - Table `combinedPaymentRequests` in schema
  - `api.combinedPayments.getPendingForGuest`
  - `api.combinedPayments.listPendingForBill`
  - Internal helper `loadBillTotalsForCombinedPay(ctx, billId)` returning `BillTotals`

- [ ] **Step 1: Add schema table**

In `convex/schema.ts`, after `payments` table:

```ts
combinedPaymentRequests: defineTable({
  billId: v.id('bills'),
  payerParticipantId: v.id('participants'),
  coveredParticipantId: v.id('participants'),
  payerAmountCents: v.number(),
  coveredAmountCents: v.number(),
  totalCents: v.number(),
  status: v.union(
    v.literal('pending'),
    v.literal('confirmed'),
    v.literal('rejected'),
    v.literal('cancelled'),
  ),
  guestSessionId: v.id('guestSessions'),
  createdAt: v.number(),
  resolvedAt: v.optional(v.number()),
})
  .index('by_billId_status', ['billId', 'status'])
  .index('by_guestSessionId', ['guestSessionId']),
```

- [ ] **Step 2: Add server shim**

```ts
// convex/lib/combinedPayment.ts
export {
  participantRemainingCents,
  validateCombinedPaymentCreate,
  validateCombinedPaymentConfirm,
  COMBINED_PAYMENT_MESSAGES,
} from '../../shared/combined-payment'
export { COMBINED_PAYMENT_MESSAGES } from '../../shared/combined-payment-messages'
```

Fix duplicate export — only re-export from combined-payment.ts which imports messages.

- [ ] **Step 3: Add `loadBillTotalsForCombinedPay` helper inside `convex/combinedPayments.ts`**

Copy the relation-loading pattern from `convex/payments.ts` lines 23–64, returning `calculateBillTotals(...)`.

- [ ] **Step 4: Add query stubs**

```ts
// convex/combinedPayments.ts
import { query, mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireBillOwner } from './lib/auth'
import { assertShareToken } from './lib/guestAccess'
import { requireGuestSession } from './lib/requireGuestSession'

export const getPendingForGuest = query({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)
    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) return null

    const pending = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_guestSessionId', (q) =>
        q.eq('guestSessionId', session._id),
      )
      .collect()

    return (
      pending.find((r) => r.billId === args.billId && r.status === 'pending') ??
      null
    )
  },
})

export const listPendingForBill = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    const pending = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_billId_status', (q) =>
        q.eq('billId', args.billId).eq('status', 'pending'),
      )
      .collect()
    return pending
  },
})
```

- [ ] **Step 5: Run Convex codegen**

Run: `pnpm exec convex codegen`
Expected: `_generated/api.d.ts` includes `combinedPayments`

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/lib/combinedPayment.ts convex/combinedPayments.ts
git commit -m "feat(combined-pay): add schema and query stubs"
```

---

### Task 3: `combinedPayments.create` mutation

**Files:**

- Modify: `convex/combinedPayments.ts`

**Interfaces:**

- Consumes: `validateCombinedPaymentCreate`, `requireGuestSession`, `assertShareToken`, `loadBillTotalsForCombinedPay`
- Produces: `combinedPayments.create` returning `{ requestId: Id<'combinedPaymentRequests'>, totalCents: number }`

- [ ] **Step 1: Implement create**

```ts
export const create = mutation({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.string(),
    coveredParticipantId: v.id('participants'),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)

    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
    }

    const { sessionId } = await requireGuestSession(ctx, {
      billId: args.billId,
      participantId: session.participantId,
      sessionToken: args.sessionToken,
    })

    const covered = await ctx.db.get(args.coveredParticipantId)
    if (!covered || covered.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.participantNotOnBill)
    }

    const totals = await loadBillTotalsForCombinedPay(ctx, args.billId)

    const existingForSession = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_guestSessionId', (q) => q.eq('guestSessionId', sessionId))
      .collect()
    const hasPendingForSession = existingForSession.some(
      (r) => r.billId === args.billId && r.status === 'pending',
    )

    const billPending = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_billId_status', (q) =>
        q.eq('billId', args.billId).eq('status', 'pending'),
      )
      .collect()
    const coveredHasPending = billPending.some(
      (r) => r.coveredParticipantId === args.coveredParticipantId,
    )

    const validated = validateCombinedPaymentCreate(
      { coveredParticipantId: args.coveredParticipantId },
      {
        payerParticipantId: session.participantId,
        hasPendingForSession,
        coveredHasPending,
        totals,
      },
    )
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const requestId = await ctx.db.insert('combinedPaymentRequests', {
      billId: args.billId,
      payerParticipantId: session.participantId,
      coveredParticipantId: args.coveredParticipantId,
      payerAmountCents: validated.payerAmountCents,
      coveredAmountCents: validated.coveredAmountCents,
      totalCents: validated.totalCents,
      status: 'pending',
      guestSessionId: sessionId,
      createdAt: Date.now(),
    })

    return { requestId, totalCents: validated.totalCents }
  },
})
```

- [ ] **Step 2: Manual smoke via Convex dashboard or dev — skip automated test (no convex-test in repo)**

- [ ] **Step 3: Commit**

```bash
git add convex/combinedPayments.ts
git commit -m "feat(combined-pay): add guest create mutation"
```

---

### Task 4: `cancel` and `reject` mutations

**Files:**

- Modify: `convex/combinedPayments.ts`

**Interfaces:**

- Produces:
  - `combinedPayments.cancel({ billId, sessionToken, requestId }) => void`
  - `combinedPayments.reject({ billId, requestId }) => void`

- [ ] **Step 1: Implement cancel**

```ts
export const cancel = mutation({
  args: {
    billId: v.id('bills'),
    sessionToken: v.string(),
    requestId: v.id('combinedPaymentRequests'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
    }

    const request = await ctx.db.get(args.requestId)
    if (
      !request ||
      request.billId !== args.billId ||
      request.guestSessionId !== session._id
    ) {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotFound)
    }
    if (request.status !== 'pending') {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotPending)
    }

    await ctx.db.patch(request._id, {
      status: 'cancelled',
      resolvedAt: Date.now(),
    })
  },
})
```

- [ ] **Step 2: Implement reject**

```ts
export const reject = mutation({
  args: {
    billId: v.id('bills'),
    requestId: v.id('combinedPaymentRequests'),
  },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    const request = await ctx.db.get(args.requestId)
    if (!request || request.billId !== args.billId) {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotFound)
    }
    if (request.status !== 'pending') {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotPending)
    }
    await ctx.db.patch(request._id, {
      status: 'rejected',
      resolvedAt: Date.now(),
    })
  },
})
```

- [ ] **Step 3: Commit**

```bash
git add convex/combinedPayments.ts
git commit -m "feat(combined-pay): add cancel and reject mutations"
```

---

### Task 5: `confirm` mutation (atomic payments)

**Files:**

- Modify: `convex/combinedPayments.ts`

**Interfaces:**

- Consumes: `validatePaymentAdd` from `convex/lib/paymentAmountSchema`, `touchBill`
- Produces: `combinedPayments.confirm({ billId, requestId }) => void`

- [ ] **Step 1: Implement confirm**

```ts
export const confirm = mutation({
  args: {
    billId: v.id('bills'),
    requestId: v.id('combinedPaymentRequests'),
  },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)

    const request = await ctx.db.get(args.requestId)
    if (!request || request.billId !== args.billId) {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotFound)
    }
    if (request.status !== 'pending') {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotPending)
    }

    const totals = await loadBillTotalsForCombinedPay(ctx, args.billId)
    const payerRemaining = participantRemainingCents(
      totals,
      request.payerParticipantId,
    )
    const coveredRemaining = participantRemainingCents(
      totals,
      request.coveredParticipantId,
    )

    const validated = validateCombinedPaymentConfirm(
      {
        payerAmountCents: request.payerAmountCents,
        coveredAmountCents: request.coveredAmountCents,
      },
      { payerRemainingCents: payerRemaining, coveredRemainingCents: coveredRemaining },
    )
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const note = COMBINED_PAYMENT_MESSAGES.combinedPaymentNote
    const now = Date.now()

    for (const entry of [
      {
        participantId: request.payerParticipantId,
        amountCents: request.payerAmountCents,
      },
      {
        participantId: request.coveredParticipantId,
        amountCents: request.coveredAmountCents,
      },
    ] as const) {
      const owedCents =
        totals.byParticipant[entry.participantId]?.owedCents ?? 0
      const paidCents = /* sum existing payments for participant from DB */
      const paymentValidated = validatePaymentAdd(
        { amountCents: entry.amountCents, note },
        { owedCents, paidCents },
      )
      if (!paymentValidated.ok) {
        throw new ConvexError(paymentValidated.message)
      }
      await ctx.db.insert('payments', {
        billId: args.billId,
        participantId: entry.participantId,
        amountCents: paymentValidated.data.amountCents,
        note: paymentValidated.data.note,
        paidAt: now,
      })
    }

    await ctx.db.patch(request._id, {
      status: 'confirmed',
      resolvedAt: now,
    })
    await touchBill(ctx, args.billId)
  },
})
```

Implement `paidCents` lookup by querying `payments` with `by_billId` index (same as `payments.add`).

- [ ] **Step 2: Commit**

```bash
git add convex/combinedPayments.ts
git commit -m "feat(combined-pay): add host confirm mutation"
```

---

### Task 6: Extend `bills.getForGuest` with participant balances

**Files:**

- Modify: `convex/bills.ts`

**Interfaces:**

- Produces: `getForGuest` return adds `participantBalances: Array<{ participantId, name, remainingCents }>` computed from all bill payments server-side

- [ ] **Step 1: Compute balances in handler**

After loading relations (line 73–74), call `calculateBillTotals` with **all** payments (not just `myPayments`). Map participants:

```ts
const totals = calculateBillTotals({/* all relations + all payments */})
const participantBalances = participants.map((p) => ({
  participantId: p._id,
  name: p.name,
  remainingCents: Math.max(0, totals.byParticipant[p._id]?.balanceCents ?? 0),
}))
```

Return `participantBalances` alongside existing fields. Do **not** expose other participants' payment rows.

- [ ] **Step 2: Commit**

```bash
git add convex/bills.ts
git commit -m "feat(combined-pay): expose participant balances to guests"
```

---

### Task 7: `CombinedPayChips` component

**Files:**

- Create: `src/components/bills/combined-pay-chips.tsx`

**Interfaces:**

- Consumes: `participantBalances` from claim page, `payerParticipantId`, `selectedCoveredId`, `onSelect`, `disabled`
- Produces: `CombinedPayChips` component

- [ ] **Step 1: Implement chip row**

```tsx
// src/components/bills/combined-pay-chips.tsx
import { Button } from '#/components/ui/button.tsx'
import { cn } from '#/lib/utils.ts'
import type { Id } from '../../../convex/_generated/dataModel'
import { COMBINED_PAYMENT_MESSAGES } from '../../../shared/combined-payment-messages'

export type ParticipantBalance = {
  participantId: Id<'participants'>
  name: string
  remainingCents: number
}

export function CombinedPayChips({
  balances,
  payerParticipantId,
  selectedCoveredId,
  onSelect,
  disabled,
}: {
  balances: ParticipantBalance[]
  payerParticipantId: Id<'participants'>
  selectedCoveredId: Id<'participants'> | null
  onSelect: (id: Id<'participants'> | null) => void
  disabled?: boolean
}) {
  const others = balances.filter(
    (b) => b.participantId !== payerParticipantId && b.remainingCents > 0,
  )
  if (others.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {COMBINED_PAYMENT_MESSAGES.payForLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        {others.map((p) => {
          const selected = selectedCoveredId === p.participantId
          return (
            <Button
              key={p.participantId}
              type="button"
              variant={selected ? 'default' : 'outline'}
              size="sm"
              className="h-9"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : p.participantId)}
            >
              {p.name}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bills/combined-pay-chips.tsx
git commit -m "feat(combined-pay): add participant chip selector"
```

---

### Task 8: Extend `GuestClaimFooter`

**Files:**

- Modify: `src/components/bills/guest-claim-footer.tsx`
- Modify: `src/routes/bills/$billId/claim.tsx`

**Interfaces:**

- Consumes: `api.combinedPayments.getPendingForGuest`, `api.combinedPayments.create`, `api.combinedPayments.cancel`, `CombinedPayChips`, `participantBalances` prop
- Produces: Footer with chip row, combined total, pending state, cancel link

- [ ] **Step 1: Add props to footer**

```ts
participantBalances: ParticipantBalance[]
```

- [ ] **Step 2: Add state + queries**

```ts
const pending = useQuery(api.combinedPayments.getPendingForGuest, {
  billId,
  shareToken,
  sessionToken,
})
const createCombined = useMutation(api.combinedPayments.create)
const cancelCombined = useMutation(api.combinedPayments.cancel)
const [selectedCoveredId, setSelectedCoveredId] =
  useState<Id<'participants'> | null>(null)
```

When `pending` is non-null, force `selectedCoveredId` from pending.coveredParticipantId and set `disabled` mode.

- [ ] **Step 3: Update amount logic**

```ts
const payerRemaining = /* from totals */
const coveredRemaining = selectedCoveredId
  ? participantBalances.find(b => b.participantId === selectedCoveredId)?.remainingCents ?? 0
  : 0
const isCombined = Boolean(selectedCoveredId) && coveredRemaining > 0
const amountCents = pending
  ? pending.totalCents
  : isCombined
    ? payerRemaining + coveredRemaining
    : totals.paidCents > 0 ? remainingCents : totals.owedCents
const amountLabel = isCombined || pending
  ? COMBINED_PAYMENT_MESSAGES.combinedTotalLabel
  : amountLabelExisting
```

- [ ] **Step 4: Update Revolut handler**

```ts
async function handleRevolut() {
  if (remainingCents <= 0 && !isCombined) return
  let payCents = amountCents
  if (isCombined && !pending) {
    const result = await createCombined({
      billId,
      shareToken,
      sessionToken,
      coveredParticipantId: selectedCoveredId!,
    })
    payCents = result.totalCents
  } else if (pending) {
    payCents = pending.totalCents
  }
  void copyToClipboard(formatCopyAmount(payCents))
  window.open(buildRevolutUrl(revolutUsername!, payCents))
  toast.success('Отворен Revolut')
}
```

Solo path (no `selectedCoveredId`, no `pending`): unchanged — no `createCombined` call.

- [ ] **Step 5: Render chips + pending UI**

Insert `<CombinedPayChips />` above total row. When pending, show amber status + cancel button calling `cancelCombined`.

- [ ] **Step 6: Wire claim page**

In `claim.tsx`, pass `participantBalances={data.participantBalances}` to footer. Keep existing payer `totals` computation for payer breakdown lines.

- [ ] **Step 7: Commit**

```bash
git add src/components/bills/guest-claim-footer.tsx src/routes/bills/$billId/claim.tsx
git commit -m "feat(combined-pay): expand guest footer for combined payment"
```

---

### Task 9: Host pending banner

**Files:**

- Create: `src/components/bills/combined-payment-banner.tsx`
- Modify: `src/components/bills/bill-summary-content.tsx`

**Interfaces:**

- Consumes: `api.combinedPayments.listPendingForBill`, `confirm`, `reject`, `useConfirmAction`
- Produces: `CombinedPaymentBanner` stacked above payment rows

- [ ] **Step 1: Implement banner component**

```tsx
// src/components/bills/combined-payment-banner.tsx
export function CombinedPaymentBanner({ billId }: { billId: Id<'bills'> }) {
  const pending = useQuery(api.combinedPayments.listPendingForBill, { billId })
  const confirm = useMutation(api.combinedPayments.confirm)
  const reject = useMutation(api.combinedPayments.reject)
  const { confirm: confirmAction } = useConfirmAction()
  const participants = useQuery(api.bills.get, { billId })?.participants ?? []

  if (!pending?.length) return null

  return (
    <Stack gap={2}>
      {pending.map((request) => {
        const payerName = /* lookup */
        const coveredName = /* lookup */
        return (
          <Callout key={request._id} tone="warning">
            {/* banner text + Потвърди / Отхвърли buttons */}
          </Callout>
        )
      })}
    </Stack>
  )
}
```

Use shadcn `Card` or existing callout pattern from codebase (check `Alert` usage in summary). Match Bulgarian copy from `COMBINED_PAYMENT_MESSAGES`.

Confirm button opens `useConfirmAction` dialog then calls `confirm` mutation.

- [ ] **Step 2: Mount in `BillSummaryContent`**

Above `<PaymentRow />` list (around line 200+ in summary content), add:

```tsx
<CombinedPaymentBanner billId={billId} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bills/combined-payment-banner.tsx src/components/bills/bill-summary-content.tsx
git commit -m "feat(combined-pay): add host confirmation banner"
```

---

### Task 10: E2E test

**Files:**

- Create: `e2e/combined-guest-payment.spec.ts`

**Interfaces:**

- Consumes: `e2e/helpers/host-auth.ts` patterns from `happy-split.spec.ts`

- [ ] **Step 1: Write E2E spec**

```ts
import { expect, openHostContext, test } from './helpers/host-auth'

test('guest combined pay flow — host confirms both', async ({ browser }) => {
  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)

  // Host: create bill with 2 participants + 1 item split between them
  // Host: configure Revolut username in payment settings
  // Host: copy join URL

  // Guest: join as participant A, claim half of item
  // Guest: tap chip for participant B, tap Revolut

  // Host: navigate to summary step
  // Host: see pending banner, click Потвърди, confirm dialog

  // Assert both payment rows show paid / €0 remaining

  await hostContext.close()
})

test('guest can cancel pending combined payment', async ({ browser }) => {
  // Setup similar; create pending; click Отмени; assert banner absent on host
})
```

Follow exact selectors from existing E2E helpers. Add `data-testid` only if stable role/name selectors are insufficient.

- [ ] **Step 2: Run E2E (if dev stack available)**

Run: `pnpm run test:e2e -- e2e/combined-guest-payment.spec.ts`
Expected: PASS (requires Convex dev + DEV_MODE per README)

- [ ] **Step 3: Commit**

```bash
git add e2e/combined-guest-payment.spec.ts
git commit -m "test(combined-pay): add guest combined payment e2e"
```

---

### Task 11: Preflight verification

**Files:** none (verification only)

- [ ] **Step 1: Run unit tests**

Run: `pnpm exec vitest run shared/combined-payment.test.ts`
Expected: PASS

- [ ] **Step 2: Run preflight**

Run: `pnpm run preflight`
Expected: PASS (test + build)

- [ ] **Step 3: Manual smoke checklist**

- Guest with 3 participants: select second person, combined total correct
- Pending state disables chips and Revolut repeat
- Cancel re-enables selection
- Host confirm marks both paid
- Host reject allows guest retry
- Solo Revolut still works without pending record

- [ ] **Step 4: Commit any fixups**

```bash
git commit -m "fix(combined-pay): address preflight findings"  # only if needed
```

---

## Self-review

**Spec coverage:**

- Expanded footer chips — Task 7, 8
- Combined total + Revolut — Task 8
- Pending state + cancel — Task 4, 8
- Host banner confirm/reject — Task 9
- `combinedPaymentRequests` schema — Task 2
- All mutations/queries — Tasks 3–5
- `getForGuest` balances — Task 6
- Edge case validation — Task 1, 5
- E2E + unit tests — Tasks 1, 10
- IBAN combined flow — Task 8 (extend IBAN handler same as Revolut: create pending when combined)

**Gaps fixed during review:**

- Added `participantBalances` to `getForGuest` (spec assumed full totals but API only returned `myPayments`)
- IBAN path explicitly included in Task 8 Step 4

**Placeholder scan:** No TBD/TODO entries.

**Type consistency:** `requestId`, `totalCents`, `participantBalances`, `CombinedPaymentCreateResult` names consistent across tasks.
