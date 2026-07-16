# Finalize Full Read-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After **Завърши сметка** (`bill.status === 'final'`), block every bill content mutation on the server and hide payment/edit affordances in the UI, while keeping view/share/copy and **delete** available.

**Architecture:** Shared `assertBillDraft(bill)` throws `GUEST_FLOW_MESSAGES.billFinalNoEdit` when `status === 'final'`. Call it from payments, bill update/rotate, and combined-payment mutators. UI passes `readOnly` into payment controls and invite rotate; finalize confirm copy mentions the payment lock.

**Tech Stack:** Convex mutations, TypeScript, Vitest, React, Playwright e2e

**Spec:** `docs/superpowers/specs/2026-07-16-finalize-full-readonly-design.md`

## Global Constraints

- Lock applies only when `bill.status === 'final'` (not “everyone paid”)
- Error copy: `GUEST_FLOW_MESSAGES.billFinalNoEdit` → `Сметката е приключена и не може да се редактира.`
- Delete (`bills.remove`) stays allowed
- View, share, copy amounts stay allowed
- Payment history may remain visible; no mark-paid / partial / undo when final
- Do not migrate every existing inline `status === 'final'` check in this plan (YAGNI); new gaps must use the helper
- Prefer TDD for the helper; UI/e2e verify the product behavior

---

## File map

| File                                                     | Responsibility                                             |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| `convex/lib/assertBillDraft.ts`                          | `assertBillDraft({ status })`                              |
| `convex/lib/assertBillDraft.test.ts`                     | Unit tests for draft vs final                              |
| `convex/payments.ts`                                     | Guard `add` / `undoLast`                                   |
| `convex/bills.ts`                                        | Guard `update` / `rotateShareToken` (not `remove`)         |
| `convex/combinedPayments.ts`                             | Guard all mutating handlers                                |
| `src/components/bills/payment-actions.tsx`               | `readOnly` → history only                                  |
| `src/components/bills/payment-row.tsx`                   | Pass `readOnly` into `PaymentActions`                      |
| `src/components/bills/participant-breakdown-content.tsx` | Pass `readOnly` into `PaymentActions`                      |
| `src/components/bills/participant-detail-sheet.tsx`      | Optional `paymentActionsReadOnly` prop                     |
| `src/components/bills/bill-summary-content.tsx`          | Wire draft vs final; finalize copy                         |
| `src/components/bills/bill-invite-card.tsx`              | Hide/disable rotate when final                             |
| `src/routes/bills/$billId/index.tsx`                     | Pass `readOnly` into invite card when final                |
| `e2e/final-readonly.spec.ts`                             | Host: no payment undo after finalize; delete still present |
| Spec status                                              | Mark Complete when done                                    |

---

### Task 1: `assertBillDraft` helper (TDD)

**Files:**

- Create: `convex/lib/assertBillDraft.ts`
- Create: `convex/lib/assertBillDraft.test.ts`

**Interfaces:**

- Consumes: `ConvexError` from `convex/values`; `GUEST_FLOW_MESSAGES` from `./guestFlowMessages`
- Produces:

```ts
export function assertBillDraft(bill: { status: 'draft' | 'final' }): void
```

- [ ] **Step 1: Write the failing test**

```ts
// convex/lib/assertBillDraft.test.ts
import { describe, expect, it } from 'vitest'
import { ConvexError } from 'convex/values'
import { assertBillDraft } from './assertBillDraft'
import { GUEST_FLOW_MESSAGES } from './guestFlowMessages'

describe('assertBillDraft', () => {
  it('passes when status is draft', () => {
    expect(() => assertBillDraft({ status: 'draft' })).not.toThrow()
  })

  it('throws billFinalNoEdit when status is final', () => {
    expect(() => assertBillDraft({ status: 'final' })).toThrow(ConvexError)
    try {
      assertBillDraft({ status: 'final' })
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError)
      expect((error as ConvexError).data).toBe(
        GUEST_FLOW_MESSAGES.billFinalNoEdit,
      )
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run convex/lib/assertBillDraft.test.ts`

Expected: FAIL (module or `assertBillDraft` not found)

- [ ] **Step 3: Write minimal implementation**

```ts
// convex/lib/assertBillDraft.ts
import { ConvexError } from 'convex/values'
import { GUEST_FLOW_MESSAGES } from './guestFlowMessages'

export function assertBillDraft(bill: { status: 'draft' | 'final' }): void {
  if (bill.status === 'final') {
    throw new ConvexError(GUEST_FLOW_MESSAGES.billFinalNoEdit)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run convex/lib/assertBillDraft.test.ts`

Expected: PASS (2 tests)

Note: If `ConvexError.data` shape differs in this Convex version, assert on `String(error)` / message the same way other ConvexError tests in the repo do — keep the thrown value equal to `GUEST_FLOW_MESSAGES.billFinalNoEdit`.

- [ ] **Step 5: Commit**

```bash
git add convex/lib/assertBillDraft.ts convex/lib/assertBillDraft.test.ts
git commit -m "$(cat <<'EOF'
feat: add assertBillDraft for finalized bill lock

EOF
)"
```

---

### Task 2: Guard payments + bill update/rotate

**Files:**

- Modify: `convex/payments.ts`
- Modify: `convex/bills.ts` (`update`, `rotateShareToken` only — do **not** guard `remove`)

**Interfaces:**

- Consumes: `assertBillDraft` from `./lib/assertBillDraft`
- Produces: mutations that reject when bill is final

- [ ] **Step 1: Guard `payments.add` and `payments.undoLast`**

In both handlers, after the bill document is loaded (and before inserting/deleting), add:

```ts
import { assertBillDraft } from './lib/assertBillDraft'

// after: const bill = await ctx.db.get(...) / requireBillOwner path
assertBillDraft(bill)
```

In `payments.add`, `bill` is already loaded around the host-participant check — call `assertBillDraft(bill)` immediately after the null check for `bill`.

In `payments.undoLast`, call `assertBillDraft(bill)` immediately after the null check for `bill`.

- [ ] **Step 2: Guard `bills.update` and `bills.rotateShareToken`**

```ts
import { assertBillDraft } from './lib/assertBillDraft'

// bills.update — right after: const bill = await requireBillOwner(ctx, billId)
assertBillDraft(bill)

// bills.rotateShareToken — after ownership check, load or use returned bill:
export const rotateShareToken = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    assertBillDraft(bill)
    const shareToken = createShareToken()
    await ctx.db.patch(args.billId, {
      shareToken,
      updatedAt: Date.now(),
    })
    return { shareToken }
  },
})
```

Do **not** add `assertBillDraft` to `bills.remove` or `bills.finalize`.

- [ ] **Step 3: Smoke-check TypeScript on touched files**

Run: `pnpm exec tsc --noEmit -p convex/tsconfig.json` (or the repo’s usual Convex typecheck if different)

Expected: no errors from these files

- [ ] **Step 4: Commit**

```bash
git add convex/payments.ts convex/bills.ts
git commit -m "$(cat <<'EOF'
feat: reject payment and bill edits when finalized

EOF
)"
```

---

### Task 3: Guard combined payment mutations

**Files:**

- Modify: `convex/combinedPayments.ts`

**Interfaces:**

- Consumes: `assertBillDraft`; bill loaded via `ctx.db.get(args.billId)` or `requireBillOwner`
- Produces: all combined-payment mutators reject on final

Mutators to guard (each after bill/session auth, before writes):

- `create`
- `updateCovered`
- `createSolo`
- `initiateTransfer`
- `cancel`
- `reject`
- `confirm`

- [ ] **Step 1: Add helper load + assert at the start of each mutator**

Pattern for guest mutators that already have `args.billId`:

```ts
import { assertBillDraft } from './lib/assertBillDraft'

const bill = await ctx.db.get(args.billId)
if (!bill) {
  throw new ConvexError(GUEST_FLOW_MESSAGES.billNotFound)
}
assertBillDraft(bill)
```

Place this after share-token / session checks where those already exist (fail closed on auth first is fine), but **before** any `insert` / `patch`.

For host mutators (`reject`, `confirm`):

```ts
const bill = await requireBillOwner(ctx, args.billId)
assertBillDraft(bill)
```

(`requireBillOwner` already returns the bill — use that return value instead of a second `get`.)

- [ ] **Step 2: Verify no mutator in the file still writes without the assert**

Manually scan `export const … = mutation` in `convex/combinedPayments.ts` and confirm each write path calls `assertBillDraft`. Queries stay unguarded.

- [ ] **Step 3: Commit**

```bash
git add convex/combinedPayments.ts
git commit -m "$(cat <<'EOF'
feat: lock combined payments on finalized bills

EOF
)"
```

---

### Task 4: UI — hide payment mutate controls when final

**Files:**

- Modify: `src/components/bills/payment-actions.tsx`
- Modify: `src/components/bills/payment-row.tsx`
- Modify: `src/components/bills/participant-breakdown-content.tsx`
- Modify: `src/components/bills/participant-detail-sheet.tsx`
- Modify: `src/components/bills/bill-summary-content.tsx`

**Interfaces:**

- Consumes: `bill.status === 'draft'` already as `isDraft` in summary
- Produces: `readOnly?: boolean` on `PaymentActions` / `PaymentRow` / breakdown / detail sheet

- [ ] **Step 1: Add `readOnly` to `PaymentActions`**

```tsx
export interface PaymentActionsProps {
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  totals: ParticipantTotals
  payments?: Doc<'payments'>[]
  readOnly?: boolean
}

export function PaymentActions({
  // ...existing
  readOnly = false,
}: PaymentActionsProps) {
  // ...existing hooks/handlers

  if (remainingCents <= 0 && participantPayments.length === 0) return null

  return (
    <div className="flex flex-col gap-2 pt-1">
      {participantPayments.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-md border border-border/80 bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Плащания</p>
          <ul className="flex flex-col gap-1 text-sm">
            {/* unchanged list */}
          </ul>
          {!readOnly ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full justify-start px-0"
              onClick={() => void handleUndoLastWithConfirm()}
              disabled={isUndoing}
            >
              <Undo2Icon className={ICON.button} aria-hidden />
              Отмени последно плащане
            </Button>
          ) : null}
        </div>
      ) : null}

      {!readOnly && remainingCents > 0 ? (
        <>{/* existing Платено + partial UI unchanged */}</>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Thread `readOnly` through `PaymentRow` and breakdown/detail**

`payment-row.tsx`:

```tsx
export interface PaymentRowProps {
  // ...existing
  readOnly?: boolean
}

// in JSX:
{
  !isHost ? (
    <PaymentActions
      billId={billId}
      participantId={participantId}
      label={label}
      totals={totals}
      payments={payments}
      readOnly={readOnly}
    />
  ) : null
}
```

`participant-breakdown-content.tsx` / `participant-detail-sheet.tsx`:

- Add optional `paymentActionsReadOnly?: boolean` (default `false`)
- Pass to `PaymentActions` as `readOnly={paymentActionsReadOnly}` when `showPaymentActions` is true

- [ ] **Step 3: Wire summary for draft vs final**

In `bill-summary-content.tsx`:

```tsx
<PaymentRow
  // ...existing props
  readOnly={!isDraft}
/>

// ParticipantDetailSheet:
showPaymentActions={
  !isHostParticipant(detailParticipantId, bill.hostParticipantId)
}
paymentActionsReadOnly={!isDraft}
```

- [ ] **Step 4: Update finalize confirm copy**

Replace the guest-only lock sentence with text that covers payments too, e.g.:

```tsx
<p>
  След завършване сметката е само за преглед — гостите не могат да променят
  артикулите, а плащанията не могат да се отменят или добавят.
</p>
```

- [ ] **Step 5: Manual smoke (dev)**

1. Draft bill with a paid guest → summary shows undo.
2. Finalize → undo / Платено / partial gone; payment history still visible if any.
3. Delete button still present.

- [ ] **Step 6: Commit**

```bash
git add \
  src/components/bills/payment-actions.tsx \
  src/components/bills/payment-row.tsx \
  src/components/bills/participant-breakdown-content.tsx \
  src/components/bills/participant-detail-sheet.tsx \
  src/components/bills/bill-summary-content.tsx
git commit -m "$(cat <<'EOF'
feat: hide payment controls on finalized bills

EOF
)"
```

---

### Task 5: UI — disable invite rotate on final

**Files:**

- Modify: `src/components/bills/bill-invite-card.tsx`
- Modify: `src/routes/bills/$billId/index.tsx` (where `BillInviteCard` is rendered)

**Interfaces:**

- Consumes: `bill.status`
- Produces: `readOnly?: boolean` on `BillInviteCard` — when true, hide **Обнови линка** (share/QR still OK if not `disabled`)

- [ ] **Step 1: Add `readOnly` prop to invite card**

```tsx
export interface BillInviteCardProps {
  billId: Id<'bills'>
  shareToken?: string
  disabled?: boolean
  readOnly?: boolean
}

export function BillInviteCard({
  billId,
  shareToken,
  disabled,
  readOnly = false,
}: BillInviteCardProps) {
  // ...existing

  // In the shareToken branch, wrap the rotate button:
  {
    !readOnly ? (
      <Button
        type="button"
        variant="ghost"
        className="h-10 w-full text-muted-foreground"
        onClick={() => setRotateOpen(true)}
      >
        <Link2OffIcon className={ICON.button} aria-hidden />
        Обнови линка
      </Button>
    ) : null
  }
}
```

- [ ] **Step 2: Pass `readOnly` from editor**

In `src/routes/bills/$billId/index.tsx` step 2 invite card:

```tsx
<BillInviteCard
  billId={billId}
  shareToken={bill.shareToken}
  disabled={participants.length === 0}
  readOnly={bill.status === 'final'}
/>
```

(Editor already redirects final → step 4; this still closes the UI hole if invite is shown elsewhere later.)

- [ ] **Step 3: Commit**

```bash
git add src/components/bills/bill-invite-card.tsx src/routes/bills/$billId/index.tsx
git commit -m "$(cat <<'EOF'
feat: hide share-token rotate on finalized bills

EOF
)"
```

---

### Task 6: E2E + mark spec complete

**Files:**

- Modify: `e2e/final-readonly.spec.ts`
- Modify: `docs/superpowers/specs/2026-07-16-finalize-full-readonly-design.md` (Status → Complete)

**Interfaces:**

- Consumes: existing `openHostContext` helper; finalize flow from current e2e
- Produces: host assertion that payment undo is absent after finalize; delete still visible

- [ ] **Step 1: Extend e2e**

Add this second test to `e2e/final-readonly.spec.ts` (keep the existing guest claim test). Reuse the same step/claim patterns as `e2e/host-paid-summary.spec.ts`:

```ts
import type { Page } from '@playwright/test'
import { expect, openHostContext, test } from './helpers/host-auth'

async function getJoinUrl(hostPage: Page) {
  const joinUrl = await hostPage.getByTestId('join-url').textContent()
  expect(joinUrl).toBeTruthy()
  return joinUrl!
}

async function goToBillStep(hostPage: Page, step: 2 | 3 | 4) {
  const labels = ['Бележка', 'Участници', 'Разпределение', 'Преглед'] as const
  await hostPage.getByLabel(`Стъпка ${step}: ${labels[step - 1]}`).click()
}

async function claimItem(page: Page, itemName: string) {
  await page.getByRole('button', { name: new RegExp(itemName) }).click()
  await expect(page.getByText('Разбивка на дяла')).toBeVisible()
}

function participantRow(page: Page, participantName: string) {
  return page
    .locator('div.rounded-lg.border')
    .filter({ has: page.getByText(participantName, { exact: true }) })
}

// existing guest read-only test stays…

test('finalized bill hides payment undo for host and keeps delete', async ({
  browser,
}) => {
  const stamp = Date.now()
  const guestName = `FinalPay ${stamp}`
  const itemName = 'Кафе'
  const restaurantName = `E2E Final Pay ${stamp}`

  const { context: hostContext, page: hostPage } =
    await openHostContext(browser)

  await hostPage.getByRole('button', { name: 'Нова сметка' }).click()
  await hostPage.getByLabel('Ресторант').fill(restaurantName)

  await goToBillStep(hostPage, 2)
  await hostPage.getByPlaceholder('Име на участник').fill(guestName)
  await hostPage.getByRole('button', { name: 'Добави' }).click()
  await expect(hostPage.getByText(guestName)).toBeVisible()

  const joinUrl = await getJoinUrl(hostPage)
  const billId = hostPage.url().match(/\/bills\/([^/?]+)/)?.[1]
  expect(billId).toBeTruthy()

  await goToBillStep(hostPage, 3)
  await hostPage.getByRole('button', { name: 'Добави артикул' }).click()
  await hostPage.getByPlaceholder('Наименование на артикул').fill(itemName)
  await hostPage.getByPlaceholder('Цена (€)').first().fill('3.00')
  await hostPage.getByRole('button', { name: 'Добави' }).click()
  await expect(hostPage.getByText(itemName)).toBeVisible()

  const guestContext = await browser.newContext()
  const guestPage = await guestContext.newPage()
  await guestPage.goto(joinUrl)
  await guestPage.getByRole('button', { name: guestName }).click()
  await expect(guestPage).toHaveURL(new RegExp(`/bills/${billId}/claim`))
  await claimItem(guestPage, itemName)
  await guestContext.close()

  await goToBillStep(hostPage, 4)
  const guestRow = participantRow(hostPage, guestName)
  await guestRow.getByRole('button', { name: 'Платено' }).click()
  await expect(
    guestRow.getByRole('button', { name: 'Отмени последно плащане' }),
  ).toBeVisible()

  await hostPage.getByRole('button', { name: 'Завърши сметка' }).click()
  await hostPage
    .getByRole('dialog')
    .getByRole('button', { name: 'Завърши сметка' })
    .click()
  await expect(hostPage.getByText(/Завършена/)).toBeVisible()

  await expect(
    hostPage.getByRole('button', { name: 'Отмени последно плащане' }),
  ).toHaveCount(0)
  await expect(hostPage.getByRole('button', { name: 'Платено' })).toHaveCount(0)
  await expect(hostPage.getByRole('button', { name: 'Изтрий' })).toBeVisible()

  await hostContext.close()
})
```

- [ ] **Step 2: Run e2e file (when Convex + DEV_MODE available)**

Run: `pnpm run test:e2e -- e2e/final-readonly.spec.ts`

Expected: PASS

If env missing, document in the commit body and still land the test; do not skip writing it.

- [ ] **Step 3: Mark spec Complete**

In `docs/superpowers/specs/2026-07-16-finalize-full-readonly-design.md`:

```md
**Status:** Complete
```

- [ ] **Step 4: Commit**

```bash
git add e2e/final-readonly.spec.ts docs/superpowers/specs/2026-07-16-finalize-full-readonly-design.md
git commit -m "$(cat <<'EOF'
test: cover finalized bill payment lock; mark spec complete

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement                          | Task                         |
| ----------------------------------------- | ---------------------------- |
| `assertBillDraft` + `billFinalNoEdit`     | Task 1                       |
| Guard `payments.add` / `undoLast`         | Task 2                       |
| Guard `bills.update` / `rotateShareToken` | Task 2                       |
| Keep `bills.remove`                       | Task 2 (explicit non-change) |
| Guard combined payments                   | Task 3                       |
| Hide payment mutate UI; history OK        | Task 4                       |
| Finalize dialog copy                      | Task 4                       |
| Disable rotate link UI                    | Task 5                       |
| E2E host lock + delete                    | Task 6                       |
| Guest claim read-only unchanged           | Task 6 (existing test kept)  |

## Out of scope (do not implement)

- Auto-finalize when everyone paid
- Lock on “all paid” before finalize
- Re-open / unlock finalized bills
- Migrating all existing inline `Сметката е завършена.` strings to the helper
