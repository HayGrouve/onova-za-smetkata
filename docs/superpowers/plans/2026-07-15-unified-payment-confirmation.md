# Unified Payment Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify solo and combined guest Revolut/IBAN payments so the host confirms every transfer from one stacked banner list on bill step 4.

**Architecture:** Extend `combinedPaymentRequests` with optional `coveredParticipantId` (solo when absent) and `transferInitiatedAt` (host visibility gate). Solo creates pending + initiates transfer in one mutation; combined creates on chip select and patches `transferInitiatedAt` on Revolut/IBAN tap. Host `listPendingForBill` filters to initiated requests only; `confirm` inserts 1 or 2 `payments` rows based on request type.

**Tech Stack:** Convex, TanStack Start/React 19, Shadcn UI, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-07-15-unified-payment-confirmation-design.md`

## Global Constraints

- Host layout: stacked confirmation cards at top of payments card (no bulk confirm in v1)
- Solo pay: pending request created on Revolut/IBAN tap with `transferInitiatedAt = now`
- Combined pay: `create` on chip select (no `transferInitiatedAt`); `initiateTransfer` on Revolut/IBAN tap
- Covered guest notice: unchanged — appears on chip select before transfer
- Confirm: solo → 1 `payments` row; combined → 2 rows (atomic)
- Copy language: Bulgarian UI strings
- Amounts: EUR integer cents only
- Table rename out of scope — keep `combinedPaymentRequests`

---

## File map

| File | Responsibility |
|------|----------------|
| `convex/schema.ts` | Optional `coveredParticipantId`, add `transferInitiatedAt` |
| `shared/combined-payment-messages.ts` | Solo host banner/confirm/toast strings |
| `shared/combined-payment.ts` | `validateSoloPaymentCreate`, `validateInitiateTransfer`, `isAwaitingHostConfirmation` |
| `shared/combined-payment.test.ts` | Vitest for new helpers |
| `convex/combinedPayments.ts` | `createSolo`, `initiateTransfer`; update `confirm`, `listPendingForBill` |
| `src/components/bills/guest-claim-footer.tsx` | Wire solo/combined transfer lifecycle; drop local `transferInitiated` |
| `src/components/bills/combined-payment-banner.tsx` | Solo + combined card rendering |
| `e2e/combined-guest-payment.spec.ts` | Fix timing assertion; add solo + chip-only tests |

---

### Task 1: Shared solo/transfer validation helpers (TDD)

**Files:**
- Modify: `shared/combined-payment-messages.ts`
- Modify: `shared/combined-payment.ts`
- Modify: `shared/combined-payment.test.ts`

**Interfaces:**
- Produces:
  - `validateSoloPaymentCreate(ctx): { ok: true; payerAmountCents: number; totalCents: number } | { ok: false; message: string }`
  - `validateInitiateTransfer(request): { ok: true } | { ok: false; message: string }`
  - `isAwaitingHostConfirmation(request: { status: string; transferInitiatedAt?: number }): boolean`
  - `isSoloPaymentRequest(request: { coveredParticipantId?: string }): boolean`
  - New messages: `soloHostBanner`, `soloHostConfirmPrompt`, `transferNotInitiated`, `transferAlreadyInitiated`

- [ ] **Step 1: Write failing tests**

```ts
// shared/combined-payment.test.ts — append
import {
  isAwaitingHostConfirmation,
  isSoloPaymentRequest,
  validateInitiateTransfer,
  validateSoloPaymentCreate,
} from './combined-payment'

describe('validateSoloPaymentCreate', () => {
  const baseCtx = {
    payerParticipantId: 'p1',
    hasPendingForSession: false,
    totals: totals({ p1: { owedCents: 1250, paidCents: 0 } }),
  }

  it('accepts payer with remaining balance', () => {
    expect(validateSoloPaymentCreate(baseCtx)).toEqual({
      ok: true,
      payerAmountCents: 1250,
      totalCents: 1250,
    })
  })

  it('rejects zero remaining', () => {
    const result = validateSoloPaymentCreate({
      ...baseCtx,
      totals: totals({ p1: { owedCents: 1250, paidCents: 1250 } }),
    })
    expect(result.ok).toBe(false)
  })

  it('rejects duplicate pending for session', () => {
    const result = validateSoloPaymentCreate({
      ...baseCtx,
      hasPendingForSession: true,
    })
    expect(result.ok).toBe(false)
  })
})

describe('validateInitiateTransfer', () => {
  it('accepts combined pending without transferInitiatedAt', () => {
    expect(
      validateInitiateTransfer({
        status: 'pending',
        coveredParticipantId: 'p2',
        transferInitiatedAt: undefined,
      }),
    ).toEqual({ ok: true })
  })

  it('rejects solo request', () => {
    expect(
      validateInitiateTransfer({
        status: 'pending',
        coveredParticipantId: undefined,
        transferInitiatedAt: undefined,
      }).ok,
    ).toBe(false)
  })

  it('rejects already initiated', () => {
    expect(
      validateInitiateTransfer({
        status: 'pending',
        coveredParticipantId: 'p2',
        transferInitiatedAt: 1,
      }).ok,
    ).toBe(false)
  })
})

describe('isAwaitingHostConfirmation', () => {
  it('true when pending and transfer initiated', () => {
    expect(
      isAwaitingHostConfirmation({ status: 'pending', transferInitiatedAt: 99 }),
    ).toBe(true)
  })

  it('false when pending but not initiated', () => {
    expect(
      isAwaitingHostConfirmation({ status: 'pending', transferInitiatedAt: undefined }),
    ).toBe(false)
  })
})

describe('isSoloPaymentRequest', () => {
  it('true without covered participant', () => {
    expect(isSoloPaymentRequest({})).toBe(true)
  })

  it('false with covered participant', () => {
    expect(isSoloPaymentRequest({ coveredParticipantId: 'p2' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run shared/combined-payment.test.ts`
Expected: FAIL — exports not defined

- [ ] **Step 3: Implement helpers and messages**

```ts
// shared/combined-payment-messages.ts — add
soloHostBanner: '{payer} плати {total}',
soloHostConfirmPrompt: 'Маркира {payer} като платен?',
transferNotInitiated: 'Първо отворете Revolut или копирайте IBAN.',
transferAlreadyInitiated: 'Плащането вече е изпратено.',
```

```ts
// shared/combined-payment.ts — add
export type SoloPaymentCreateContext = {
  payerParticipantId: string
  hasPendingForSession: boolean
  totals: BillTotals
}

export type PaymentRequestTransferState = {
  status: string
  coveredParticipantId?: string
  transferInitiatedAt?: number
}

export function isSoloPaymentRequest(request: {
  coveredParticipantId?: string
}): boolean {
  return !request.coveredParticipantId
}

export function isAwaitingHostConfirmation(request: {
  status: string
  transferInitiatedAt?: number
}): boolean {
  return request.status === 'pending' && request.transferInitiatedAt != null
}

export function validateSoloPaymentCreate(
  ctx: SoloPaymentCreateContext,
):
  | { ok: true; payerAmountCents: number; totalCents: number }
  | { ok: false; message: string } {
  if (ctx.hasPendingForSession) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.pendingExists }
  }
  const payerAmountCents = participantRemainingCents(
    ctx.totals,
    ctx.payerParticipantId,
  )
  if (payerAmountCents <= 0) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.payerNothingOwed }
  }
  return { ok: true, payerAmountCents, totalCents: payerAmountCents }
}

export function validateInitiateTransfer(
  request: PaymentRequestTransferState,
): { ok: true } | { ok: false; message: string } {
  if (request.status !== 'pending') {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.requestNotPending }
  }
  if (isSoloPaymentRequest(request)) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.transferNotInitiated }
  }
  if (request.transferInitiatedAt != null) {
    return {
      ok: false,
      message: COMBINED_PAYMENT_MESSAGES.transferAlreadyInitiated,
    }
  }
  return { ok: true }
}
```

Update `convex/lib/combinedPayment.ts` re-exports for new symbols.

- [ ] **Step 4: Run tests**

Run: `pnpm exec vitest run shared/combined-payment.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/combined-payment.ts shared/combined-payment-messages.ts shared/combined-payment.test.ts convex/lib/combinedPayment.ts
git commit -m "feat(payment-confirm): add solo and transfer validation helpers"
```

---

### Task 2: Schema + backend mutations

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/combinedPayments.ts`

**Interfaces:**
- Consumes: helpers from Task 1
- Produces:
  - `api.combinedPayments.createSolo({ billId, shareToken, sessionToken }) → { requestId, totalCents }`
  - `api.combinedPayments.initiateTransfer({ billId, sessionToken, requestId }) → void`
  - `listPendingForBill` returns only `isAwaitingHostConfirmation` rows
  - `confirm` requires `transferInitiatedAt`; solo inserts 1 payment

- [ ] **Step 1: Update schema**

```ts
// convex/schema.ts — combinedPaymentRequests
coveredParticipantId: v.optional(v.id('participants')),
transferInitiatedAt: v.optional(v.number()),
```

- [ ] **Step 2: Add `createSolo` mutation**

```ts
export const createSolo = mutation({
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
    if (!session || session.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
    }

    const { sessionId } = await requireGuestSession(ctx, {
      billId: args.billId,
      participantId: session.participantId,
      sessionToken: args.sessionToken,
    })

    const totals = await loadBillTotalsForCombinedPay(ctx, args.billId)
    const existingForSession = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_guestSessionId', (q) => q.eq('guestSessionId', sessionId))
      .collect()
    const hasPendingForSession = existingForSession.some(
      (r) => r.billId === args.billId && r.status === 'pending',
    )

    const validated = validateSoloPaymentCreate({
      payerParticipantId: session.participantId,
      hasPendingForSession,
      totals,
    })
    if (!validated.ok) throw new ConvexError(validated.message)

    const now = Date.now()
    const requestId = await ctx.db.insert('combinedPaymentRequests', {
      billId: args.billId,
      payerParticipantId: session.participantId,
      payerAmountCents: validated.payerAmountCents,
      coveredAmountCents: 0,
      totalCents: validated.totalCents,
      status: 'pending',
      guestSessionId: sessionId,
      createdAt: now,
      transferInitiatedAt: now,
    })

    return { requestId, totalCents: validated.totalCents }
  },
})
```

- [ ] **Step 3: Add `initiateTransfer` mutation**

```ts
export const initiateTransfer = mutation({
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

    const validated = validateInitiateTransfer(request)
    if (!validated.ok) throw new ConvexError(validated.message)

    await ctx.db.patch(request._id, { transferInitiatedAt: Date.now() })
  },
})
```

- [ ] **Step 4: Update `listPendingForBill` filter**

```ts
return pending.filter((request) => isAwaitingHostConfirmation(request))
```

- [ ] **Step 5: Update `confirm` for solo + transfer gate**

At top of handler after status check:

```ts
if (request.transferInitiatedAt == null) {
  throw new ConvexError(COMBINED_PAYMENT_MESSAGES.transferNotInitiated)
}
```

Replace fixed two-row insert loop with:

```ts
const entries = isSoloPaymentRequest(request)
  ? [{ participantId: request.payerParticipantId, amountCents: request.payerAmountCents }]
  : [
      { participantId: request.payerParticipantId, amountCents: request.payerAmountCents },
      {
        participantId: request.coveredParticipantId!,
        amountCents: request.coveredAmountCents,
      },
    ]
```

Keep `validateCombinedPaymentConfirm` for combined; for solo call with `coveredAmountCents: 0` and `coveredRemainingCents: 0`.

- [ ] **Step 6: Ensure `getPendingCoverForGuest` ignores solo requests**

```ts
const cover = pending.find(
  (request) =>
    request.coveredParticipantId != null &&
    request.coveredParticipantId === session.participantId,
)
```

- [ ] **Step 7: Run preflight**

Run: `pnpm run preflight`
Expected: PASS (schema push via `convex dev` if running)

- [ ] **Step 8: Commit**

```bash
git add convex/schema.ts convex/combinedPayments.ts
git commit -m "feat(payment-confirm): add createSolo, initiateTransfer, host filter"
```

---

### Task 3: Host pending payment banner (solo + combined)

**Files:**
- Modify: `src/components/bills/combined-payment-banner.tsx`

**Interfaces:**
- Consumes: `listPendingForBill` rows (may lack `coveredParticipantId`)
- Produces: stacked cards with solo/combined copy and confirm dialogs

- [ ] **Step 1: Add solo formatters**

```ts
function formatSoloHostBanner(payerName: string, totalCents: number): string {
  return COMBINED_PAYMENT_MESSAGES.soloHostBanner
    .replace('{payer}', payerName)
    .replace('{total}', formatEur(totalCents))
}

function formatSoloHostConfirmPrompt(payerName: string): string {
  return COMBINED_PAYMENT_MESSAGES.soloHostConfirmPrompt.replace(
    '{payer}',
    payerName,
  )
}
```

- [ ] **Step 2: Branch card rendering per request type**

```ts
{pending.map((request) => {
  const payerName = labels[request.payerParticipantId] ?? 'Участник'
  const isSolo = !request.coveredParticipantId

  if (isSolo) {
    return (
      <Card key={request._id} /* ... */>
        <span>{formatSoloHostBanner(payerName, request.totalCents)}</span>
        <Button onClick={() =>
          void handleConfirmSolo(request._id, payerName)
        }>
          {COMBINED_PAYMENT_MESSAGES.confirm}
        </Button>
        {/* reject unchanged */}
      </Card>
    )
  }

  // existing combined card
})}
```

- [ ] **Step 3: Solo confirm handler + toast**

```ts
async function handleConfirmSolo(
  requestId: Id<'combinedPaymentRequests'>,
  payerName: string,
) {
  const confirmed = await confirmAction({
    title: formatSoloHostConfirmPrompt(payerName),
    confirmLabel: COMBINED_PAYMENT_MESSAGES.confirm,
    variant: 'default',
  })
  if (!confirmed) return
  await confirmMutation({ billId, requestId })
  toast.success(`${payerName} е маркиран като платен`)
}
```

- [ ] **Step 4: Manual smoke on step 4**

With `convex dev` running, open a bill summary with a seeded solo pending request; verify solo card text.

- [ ] **Step 5: Commit**

```bash
git add src/components/bills/combined-payment-banner.tsx
git commit -m "feat(payment-confirm): host banner supports solo payments"
```

---

### Task 4: Guest footer — solo create + combined initiateTransfer

**Files:**
- Modify: `src/components/bills/guest-claim-footer.tsx`

**Interfaces:**
- Consumes: `api.combinedPayments.createSolo`, `api.combinedPayments.initiateTransfer`, `pending.transferInitiatedAt`
- Produces: server-driven pending state; no local `transferInitiated`

- [ ] **Step 1: Remove local `transferInitiated` state**

Delete:
```ts
const [transferInitiated, setTransferInitiated] = useState(false)
```

Replace usages with:
```ts
const transferInitiated = pending?.transferInitiatedAt != null
```

- [ ] **Step 2: Add mutations**

```ts
const createSolo = useMutation(api.combinedPayments.createSolo)
const initiateTransfer = useMutation(api.combinedPayments.initiateTransfer)
```

- [ ] **Step 3: Update `handleRevolut`**

```ts
async function handleRevolut() {
  if (!revolutUsername || (remainingCents <= 0 && !isCombined && !pending)) return

  const payCents = await resolvePayCents()
  if (payCents === null) return

  try {
    if (!pending && !isCombined) {
      await createSolo({ billId, shareToken, sessionToken })
    } else if (pending && pending.transferInitiatedAt == null) {
      await initiateTransfer({
        billId,
        sessionToken,
        requestId: pending._id,
      })
    }
  } catch (error) {
    toast.error(getConvexErrorMessage(error))
    return
  }

  void copyToClipboard(formatCopyAmount(payCents))
  const payingForOthers = Boolean(pending || isCombined)
  const participantNames = payingForOthers
    ? [label, coveredName].filter((name): name is string => Boolean(name?.trim()))
    : [label]
  const note = buildRevolutPaymentNote(restaurantName, participantNames)
  window.open(buildRevolutUrl(revolutUsername, payCents, note))
  toast.success('Отворен Revolut')
}
```

- [ ] **Step 4: Update `handleCopyIban` similarly**

For solo (no pending, not combined): call `createSolo` before copy.
For combined pending without `transferInitiatedAt`: call `initiateTransfer`.

Remove `setTransferInitiated` calls.

- [ ] **Step 5: Fix disabled/pending UI rules**

| Condition | Pending message | Revolut disabled |
|-----------|-----------------|------------------|
| `pending?.transferInitiatedAt != null` | show + cancel | yes |
| `pending` combined, no transfer yet | hidden | no |
| solo `pending` (always initiated) | show + cancel | yes |

Update `chipsDisabled` / `payDisabledForPayer`:

```ts
const transferInitiated = pending?.transferInitiatedAt != null
const chipsDisabled =
  Boolean(pendingCover) ||
  readOnly ||
  isSelectingCover ||
  transferInitiated
```

Show cancel row when `pending && transferInitiated` (unchanged condition, now server-backed).

- [ ] **Step 6: Update `handleCancelPending`**

Remove `setTransferInitiated(false)` — rely on query refresh.

- [ ] **Step 7: Commit**

```bash
git add src/components/bills/guest-claim-footer.tsx
git commit -m "feat(payment-confirm): guest footer solo create and transfer initiate"
```

---

### Task 5: E2E — timing fix + solo flow

**Files:**
- Modify: `e2e/combined-guest-payment.spec.ts`
- Create: `e2e/solo-guest-payment.spec.ts` (optional split) OR extend existing file

**Interfaces:**
- Consumes: full stack from Tasks 1–4

- [ ] **Step 1: Add test — no host banner on chip select alone**

```ts
test('host banner hidden until guest opens Revolut', async ({ browser }) => {
  const setup = await setupCombinedPaymentBill(browser)
  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(setup.joinUrl)
  await guestPage.getByRole('button', { name: setup.participantA }).click()
  await guestPage.getByRole('button', { name: setup.participantB }).click()

  await goToBillStep(setup.hostPage, 4)
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).not.toBeVisible()

  await guestPage.getByRole('button', { name: 'Revolut' }).click()
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).toBeVisible({ timeout: 15_000 })

  await guestContext.close()
  await setup.hostContext.close()
})
```

- [ ] **Step 2: Add solo payment e2e**

```ts
test('guest solo pay — host confirms one', async ({ browser }) => {
  const setup = await setupCombinedPaymentBill(browser)

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(setup.joinUrl)
  await guestPage.getByRole('button', { name: setup.participantA }).click()
  await claimHalfOfItem(guestPage, setup.itemName)

  await guestPage.getByRole('button', { name: 'Revolut' }).click()
  await expect(
    guestPage.getByText('Чака потвърждение от домакина'),
  ).toBeVisible({ timeout: 15_000 })

  await goToBillStep(setup.hostPage, 4)
  await expect(
    setup.hostPage.getByText(new RegExp(`${setup.participantA}.*плати`)),
  ).toBeVisible({ timeout: 15_000 })

  await setup.hostPage
    .locator('[class*="border-accent"]')
    .getByRole('button', { name: 'Потвърди' })
    .click()
  await setup.hostPage
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Потвърди' })
    .click()

  await assertParticipantPaid(setup.hostPage, setup.participantA)

  await guestContext.close()
  await setup.hostContext.close()
})
```

- [ ] **Step 3: Update cancel test — host banner only after Revolut**

In `guest can cancel pending combined payment`, assert host banner **not** visible before Revolut if test currently assumes otherwise; after Revolut, banner visible; after cancel + reload, banner gone.

- [ ] **Step 4: Run e2e**

Run: `pnpm run test:e2e -- e2e/combined-guest-payment.spec.ts`
Expected: PASS

- [ ] **Step 5: Run full preflight**

Run: `pnpm run preflight`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add e2e/combined-guest-payment.spec.ts
git commit -m "test(payment-confirm): solo flow and transfer-initiated host banner"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Optional `coveredParticipantId` + `transferInitiatedAt` | Task 2 |
| `createSolo` on Revolut/IBAN tap | Tasks 2, 4 |
| `initiateTransfer` on combined Revolut/IBAN tap | Tasks 2, 4 |
| Host list filters initiated only | Task 2 |
| Solo confirm → 1 payment | Task 2 |
| Combined confirm → 2 payments | Task 2 (unchanged path) |
| Guest B notice on chip select | Task 2 (`getPendingCoverForGuest` guard) |
| Stacked host cards solo + combined | Task 3 |
| Drop local `transferInitiated` | Task 4 |
| E2E solo + timing fix | Task 5 |

## Self-review

- No TBD/TODO placeholders in task steps
- Type/symbol names consistent across tasks (`transferInitiatedAt`, `createSolo`, `initiateTransfer`)
- Each task ends with testable deliverable and commit step
- Out-of-scope items (bulk confirm, table rename) excluded
