# Guest Sharing Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve guest claim UX for shared qty=1 items and extend combined payment so a guest pays for themselves plus N others in one Revolut transfer.

**Architecture:** Pure helpers in `shared/` for share previews and multi-person payment validation; Convex schema extends `combinedPaymentRequests` with `coveredParticipantIds` and `coveredAmountsByParticipant`; guest footer uses multi-select chips with `create` / `updateCovered` / `cancel`; host banner confirms N+1 payment rows atomically. Item assignment backend unchanged.

**Tech Stack:** Convex, TanStack Start/React 19, Shadcn UI, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-07-15-guest-sharing-refactor-design.md`

## Global Constraints

- Item assignment: guest self-serve on claim screen; equal cent-split for qty=1; unit steppers for qty>1
- Multi-person payment: one transfer; payer always included; guest picks additional unpaid participants
- Trust model: host manually confirms money received (no payment processor)
- Copy language: Bulgarian UI strings (match existing guest/host flows)
- Amounts: EUR integer cents only
- Legacy: existing rows with `coveredParticipantId` must keep working in read/confirm paths
- Out of scope: unequal splits, pay-without-self, cross-bill, auto-confirm

---

## File map

| File | Responsibility |
|------|----------------|
| `shared/guest-share-preview.ts` | Pure share preview cents for qty=1 cards |
| `shared/guest-share-preview.test.ts` | Vitest for preview helper |
| `shared/combined-payment.ts` | Extend validation for N covered participants |
| `shared/combined-payment-messages.ts` | New banner/toast format strings |
| `shared/combined-payment.test.ts` | Extend Vitest for multi-cover |
| `convex/schema.ts` | Add `coveredParticipantIds`, `coveredAmountsByParticipant` |
| `convex/combinedPayments.ts` | `create` array args, `updateCovered`, N-row `confirm` |
| `convex/lib/combinedPayment.ts` | Re-export shared helpers + legacy ID resolver |
| `src/components/bills/guest-item-row.tsx` | Share preview UI on qty=1; progress on qty>1 |
| `src/components/bills/combined-pay-chips.tsx` | Multi-select chips |
| `src/components/bills/guest-claim-footer.tsx` | Wire multi-select + `updateCovered` |
| `src/components/bills/combined-payment-banner.tsx` | N-name banner/confirm/toast |
| `src/components/bills/assignment-row.tsx` | Optional „Споделено (N)“ badge |
| `e2e/guest-item-sharing.spec.ts` | 3-guest shared qty=1 item |
| `e2e/combined-guest-payment.spec.ts` | Extend for 3-person combined pay |

---

### Task 1: Share preview helper (TDD)

**Files:**
- Create: `shared/guest-share-preview.ts`
- Create: `shared/guest-share-preview.test.ts`
- Create: `src/lib/guest-share-preview.ts` (re-export shim, matches `src/lib/bill-calculations.ts` pattern)

**Interfaces:**
- Produces:
  - `previewShareCents(lineTotalCents: number, assigneeCount: number, joining: boolean): number`
  - `formatShareParticipantCount(count: number): string` → e.g. `"2 души"`

- [ ] **Step 1: Write failing tests**

```ts
// shared/guest-share-preview.test.ts
import { describe, expect, it } from 'vitest'
import { previewShareCents, formatShareParticipantCount } from './guest-share-preview'

describe('previewShareCents', () => {
  it('returns full line when solo and not joining', () => {
    expect(previewShareCents(900, 0, false)).toBe(900)
  })

  it('returns full line when solo and joining', () => {
    expect(previewShareCents(900, 0, true)).toBe(900)
  })

  it('previews join into 2-way split', () => {
    // 900 / 2 = 450
    expect(previewShareCents(900, 1, true)).toBe(450)
  })

  it('shows actual share for 3 assignees', () => {
    // 900 / 3 = 300
    expect(previewShareCents(900, 3, false)).toBe(300)
  })

  it('distributes cent remainder like splitLineTotal', () => {
    // 1000 / 3 → 334, 333, 333 — preview for joiner is last slot
    expect(previewShareCents(1000, 2, true)).toBe(334)
  })
})

describe('formatShareParticipantCount', () => {
  it('formats Bulgarian count', () => {
    expect(formatShareParticipantCount(2)).toBe('2 души')
    expect(formatShareParticipantCount(1)).toBe('1 човек')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run shared/guest-share-preview.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement helper**

```ts
// shared/guest-share-preview.ts
import { splitLineTotal } from './bill-calculations'

export function previewShareCents(
  lineTotalCents: number,
  assigneeCount: number,
  joining: boolean,
): number {
  const totalAssignees = joining ? assigneeCount + 1 : Math.max(assigneeCount, 1)
  if (totalAssignees <= 0) return lineTotalCents
  const placeholderIds = Array.from({ length: totalAssignees }, (_, i) => String(i))
  const portions = splitLineTotal(lineTotalCents, placeholderIds)
  const index = joining ? assigneeCount : 0
  return portions[index]?.cents ?? 0
}

export function formatShareParticipantCount(count: number): string {
  return count === 1 ? '1 човек' : `${count} души`
}
```

```ts
// src/lib/guest-share-preview.ts
export * from '../../shared/guest-share-preview'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run shared/guest-share-preview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/guest-share-preview.ts shared/guest-share-preview.test.ts src/lib/guest-share-preview.ts
git commit -m "feat: add guest share preview helper for qty=1 items"
```

---

### Task 2: GuestItemRow share preview UI

**Files:**
- Modify: `src/components/bills/guest-item-row.tsx`

**Interfaces:**
- Consumes: `previewShareCents`, `formatShareParticipantCount` from `#/lib/guest-share-preview.ts`
- Consumes: existing `getOtherClaimantLabels`, `getGuestClaimItemState`

- [ ] **Step 1: Add share preview to qty=1 branch**

In the `item.quantity === 1` render block:

1. Compute `otherClaimants` (already present).
2. `assigneeCount = itemAssignments.length`.
3. `shareCents = previewShareCents(lineTotalCents, assigneeCount, !isSelectedByMe)`.
4. Replace generic hint with:
   - If `otherClaimants.length > 0 && !isSelectedByMe`: show `Споделено с {names} ({formatShareParticipantCount(otherClaimants.length)})` and `Вашият дял: {formatEur(shareCents)}`.
   - If `isSelectedByMe`: show `✓ Ваше` + `Вашият дял: {formatEur(shareCents)}`.
   - If unclaimed: keep `Докоснете, за да отбележите`.
5. When others present and guest not in, add visible subtitle `Присъедини се` (card remains a button).

- [ ] **Step 2: Improve qty>1 progress copy**

Replace `{assignedUnitsTotal}/{item.quantity} разпределени` hint with:
`{assignedUnitsTotal}/{item.quantity} разпределени · остават {item.quantity - assignedUnitsTotal}`

When `isUnavailableToMe`, show `Заето` instead of stepper hint.

- [ ] **Step 3: Manual smoke**

Run dev server; open guest claim on a bill with qty=1 item claimed by another guest — preview share visible.

- [ ] **Step 4: Commit**

```bash
git add src/components/bills/guest-item-row.tsx
git commit -m "feat: show share preview on guest item cards"
```

---

### Task 3: Multi-person combined payment validation (TDD)

**Files:**
- Modify: `shared/combined-payment.ts`
- Modify: `shared/combined-payment-messages.ts`
- Modify: `shared/combined-payment.test.ts`

**Interfaces:**
- Produces:
  - `getCoveredParticipantIds(request: { coveredParticipantIds?: string[]; coveredParticipantId?: string }): string[]`
  - `isCombinedPaymentRequest(request): boolean` — true when covered IDs non-empty
  - `validateCombinedPaymentCreate(input: { coveredParticipantIds: string[] }, ctx: CombinedPaymentCreateContext): { ok: true; payerAmountCents; coveredAmountsByParticipant: Record<string, number>; coveredAmountCents; totalCents } | { ok: false; message }`
  - `validateCombinedPaymentConfirm(input: { payerAmountCents; coveredAmountsByParticipant: Record<string, number> }, ctx: { payerRemainingCents; coveredRemainingsByParticipant: Record<string, number> }): ...`
  - `validateUpdateCovered(...)` — same validation as create but `hasPendingForSession` ignored; requires `transferInitiatedAt == null`
  - Updated `isSoloPaymentRequest` — no covered IDs from legacy or array
  - Updated `validateInitiateTransfer` — uses `isCombinedPaymentRequest`

- [ ] **Step 1: Add failing tests for multi-cover**

Append to `shared/combined-payment.test.ts`:

```ts
describe('validateCombinedPaymentCreate (multi-cover)', () => {
  const baseCtx = {
    payerParticipantId: 'p1',
    hasPendingForSession: false,
    coveredPendingIds: new Set<string>(),
    totals: totals({
      p1: { owedCents: 850, paidCents: 0 },
      p2: { owedCents: 1200, paidCents: 0 },
      p3: { owedCents: 650, paidCents: 0 },
    }),
  }

  it('accepts payer + two covered', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantIds: ['p2', 'p3'] },
      baseCtx,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payerAmountCents).toBe(850)
    expect(result.coveredAmountsByParticipant).toEqual({ p2: 1200, p3: 650 })
    expect(result.coveredAmountCents).toBe(1850)
    expect(result.totalCents).toBe(2700)
  })

  it('rejects duplicate covered ids', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantIds: ['p2', 'p2'] },
      baseCtx,
    )
    expect(result.ok).toBe(false)
  })

  it('rejects when any covered has pending', () => {
    const result = validateCombinedPaymentCreate(
      { coveredParticipantIds: ['p2', 'p3'] },
      { ...baseCtx, coveredPendingIds: new Set(['p3']) },
    )
    expect(result.ok).toBe(false)
  })
})

describe('validateCombinedPaymentConfirm (multi-cover)', () => {
  it('accepts per-participant snapshotted amounts', () => {
    const result = validateCombinedPaymentConfirm(
      {
        payerAmountCents: 850,
        coveredAmountsByParticipant: { p2: 1200, p3: 650 },
      },
      {
        payerRemainingCents: 850,
        coveredRemainingsByParticipant: { p2: 1200, p3: 650 },
      },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects when one covered already paid', () => {
    const result = validateCombinedPaymentConfirm(
      {
        payerAmountCents: 850,
        coveredAmountsByParticipant: { p2: 1200, p3: 650 },
      },
      {
        payerRemainingCents: 850,
        coveredRemainingsByParticipant: { p2: 1200, p3: 0 },
      },
    )
    expect(result.ok).toBe(false)
  })
})

describe('getCoveredParticipantIds', () => {
  it('reads legacy single id', () => {
    expect(getCoveredParticipantIds({ coveredParticipantId: 'p2' })).toEqual(['p2'])
  })

  it('prefers array when present', () => {
    expect(
      getCoveredParticipantIds({
        coveredParticipantIds: ['p2', 'p3'],
        coveredParticipantId: 'p9',
      }),
    ).toEqual(['p2', 'p3'])
  })
})
```

Update existing single-cover tests to use `{ coveredParticipantIds: ['p2'] }` (keep backward compat test for old input shape if wrapper accepts both during transition).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm vitest run shared/combined-payment.test.ts`
Expected: FAIL on new tests

- [ ] **Step 3: Implement validation**

Key implementation notes:
- Replace `coveredHasPending: boolean` with `coveredPendingIds: Set<string>` in context
- Reject empty `coveredParticipantIds` on combined create (solo still uses `createSolo`)
- Reject payer in covered list; reject duplicates via `new Set(ids).size !== ids.length`
- Build `coveredAmountsByParticipant` by mapping each id to `participantRemainingCents`
- Add messages: `hostBannerMulti`, `hostConfirmPromptMulti`, `selectionLockedAfterTransfer`

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm vitest run shared/combined-payment.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/combined-payment.ts shared/combined-payment-messages.ts shared/combined-payment.test.ts
git commit -m "feat: validate multi-person combined guest payments"
```

---

### Task 4: Convex schema extension

**Files:**
- Modify: `convex/schema.ts`

**Interfaces:**
- Produces schema fields on `combinedPaymentRequests`:
  - `coveredParticipantIds: v.optional(v.array(v.id('participants')))`
  - `coveredAmountsByParticipant: v.optional(v.record(v.string(), v.number()))`

- [ ] **Step 1: Add optional fields to table**

```ts
coveredParticipantIds: v.optional(v.array(v.id('participants'))),
coveredAmountsByParticipant: v.optional(v.record(v.string(), v.number())),
```

Keep existing `coveredParticipantId` optional field unchanged.

- [ ] **Step 2: Verify Convex dev accepts schema**

Run: `pnpm exec convex dev --once` (or confirm running `npx convex dev` picked up change)
Expected: schema push succeeds

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: extend combinedPaymentRequests for multi-cover"
```

---

### Task 5: combinedPayments backend (create, updateCovered, confirm)

**Files:**
- Modify: `convex/combinedPayments.ts`
- Modify: `convex/lib/combinedPayment.ts` (if shim needs new exports)

**Interfaces:**
- Consumes: `validateCombinedPaymentCreate`, `validateCombinedPaymentConfirm`, `validateUpdateCovered`, `getCoveredParticipantIds` from `./lib/combinedPayment`
- Produces:
  - `create` args: `coveredParticipantIds: v.array(v.id('participants'))` (min length 1)
  - `updateCovered` mutation (new)
  - `confirm` inserts payer + each key in `coveredAmountsByParticipant`
  - `getPendingCoverForGuest` matches any id in covered set
  - Helper `participantIdsWithPendingCover(billPending, excludeRequestId?)` for duplicate-cover checks

- [ ] **Step 1: Add internal snapshot builder**

```ts
function buildCoveredPendingIds(
  pending: Doc<'combinedPaymentRequests'>[],
  excludeRequestId?: Id<'combinedPaymentRequests'>,
): Set<string> {
  const ids = new Set<string>()
  for (const request of pending) {
    if (excludeRequestId && request._id === excludeRequestId) continue
    if (request.status !== 'pending') continue
    for (const id of getCoveredParticipantIds(request)) ids.add(id)
  }
  return ids
}
```

- [ ] **Step 2: Update `create` mutation**

Change arg from `coveredParticipantId` to `coveredParticipantIds: v.array(v.id('participants'))`.

Insert row with:
- `coveredParticipantIds`
- `coveredAmountsByParticipant`
- `coveredAmountCents` (sum)
- `coveredParticipantId` omitted on new writes

- [ ] **Step 3: Add `updateCovered` mutation**

```ts
export const updateCovered = mutation({
  args: {
    billId: v.id('bills'),
    sessionToken: v.string(),
    requestId: v.id('combinedPaymentRequests'),
    coveredParticipantIds: v.array(v.id('participants')),
  },
  handler: async (ctx, args) => {
    // require session owns request; status pending; transferInitiatedAt == null
    // if coveredParticipantIds empty → cancel instead
    // else validateUpdateCovered + patch snapshots
  },
})
```

- [ ] **Step 4: Update `confirm` for N covered rows**

Loop `Object.entries(request.coveredAmountsByParticipant ?? legacyFallback)` and insert payment per entry. Legacy fallback: if only `coveredParticipantId` + `coveredAmountCents`, treat as single entry.

- [ ] **Step 5: Update `getPendingCoverForGuest`**

Find pending where `getCoveredParticipantIds(request)` includes `session.participantId`.

- [ ] **Step 6: Update `validateInitiateTransfer` usage**

`isCombinedPaymentRequest` replaces solo check for combined flow.

- [ ] **Step 7: Commit**

```bash
git add convex/combinedPayments.ts convex/lib/combinedPayment.ts
git commit -m "feat: multi-cover combined payment mutations"
```

---

### Task 6: CombinedPayChips multi-select

**Files:**
- Modify: `src/components/bills/combined-pay-chips.tsx`

**Interfaces:**
- Props change:
  - `selectedCoveredIds: Id<'participants'>[]`
  - `onToggle: (id: Id<'participants'>) => void`
- Remove `selectedCoveredId` / `onSelect`

- [ ] **Step 1: Update chip selection logic**

```tsx
const selected = selectedCoveredIds.includes(p.participantId)
// ...
onClick={() => onToggle(p.participantId)}
aria-pressed={selected}
```

- [ ] **Step 2: Add scrollable container for many chips**

Wrap chip row:

```tsx
<div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap">
```

- [ ] **Step 3: Commit**

```bash
git add src/components/bills/combined-pay-chips.tsx
git commit -m "feat: multi-select combined pay chips"
```

---

### Task 7: GuestClaimFooter multi-cover wiring

**Files:**
- Modify: `src/components/bills/guest-claim-footer.tsx`

**Interfaces:**
- Consumes: `api.combinedPayments.create`, `api.combinedPayments.updateCovered`, `api.combinedPayments.cancel`
- State: `selectedCoveredIds: Id<'participants'>[]`

- [ ] **Step 1: Replace single-select state with array**

```tsx
const [selectedCoveredIds, setSelectedCoveredIds] = useState<Id<'participants'>[]>([])
```

Sync from pending via `getCoveredParticipantIds(pending)` on load.

- [ ] **Step 2: Implement `handleToggleCovered`**

```tsx
async function handleToggleCovered(id: Id<'participants'>) {
  if (chipsDisabled) return
  const next = selectedCoveredIds.includes(id)
    ? selectedCoveredIds.filter((x) => x !== id)
    : [...selectedCoveredIds, id]

  setSelectedCoveredIds(next)
  setIsSelectingCover(true)
  try {
    if (next.length === 0) {
      if (pending) await cancelCombined({ billId, sessionToken, requestId: pending._id })
      return
    }
    if (!pending) {
      await createCombined({ billId, shareToken, sessionToken, coveredParticipantIds: next })
      return
    }
    if (transferInitiated) {
      toast.error(COMBINED_PAYMENT_MESSAGES.selectionLockedAfterTransfer)
      setSelectedCoveredIds(getCoveredParticipantIds(pending) as Id<'participants'>[])
      return
    }
    await updateCovered({ billId, sessionToken, requestId: pending._id, coveredParticipantIds: next })
  } catch (error) {
    toast.error(getConvexErrorMessage(error))
    setSelectedCoveredIds(pending ? (getCoveredParticipantIds(pending) as Id<'participants'>[]) : [])
  } finally {
    setIsSelectingCover(false)
  }
}
```

Import `getCoveredParticipantIds` from shared via `#/lib/combined-payment` shim (add re-export if missing).

- [ ] **Step 3: Show per-person breakdown lines**

When `selectedCoveredIds.length > 0`, render:

```tsx
<p className="text-xs text-muted-foreground">Вие: {formatEur(payerRemaining)}</p>
{selectedCoveredIds.map((id) => (
  <p key={id} className="text-xs text-muted-foreground">
    {participantLabels?.[id] ?? 'Участник'}: {formatEur(remainingFor(id))}
  </p>
))}
```

- [ ] **Step 4: Update Revolut note participant list**

```tsx
const participantNames = payingForOthers
  ? [label, ...selectedCoveredIds.map((id) => participantLabels?.[id]).filter(Boolean)]
  : [label]
```

- [ ] **Step 5: Commit**

```bash
git add src/components/bills/guest-claim-footer.tsx src/lib/combined-payment.ts
git commit -m "feat: wire multi-cover selection in guest claim footer"
```

---

### Task 8: Host CombinedPaymentBanner for N names

**Files:**
- Modify: `src/components/bills/combined-payment-banner.tsx`
- Modify: `shared/combined-payment-messages.ts`

**Interfaces:**
- Consumes: `getCoveredParticipantIds` for each pending request

- [ ] **Step 1: Add format helpers**

```ts
function formatCoveredNames(
  payerName: string,
  coveredNames: string[],
): { banner: string; confirmPrompt: string; toast: string } {
  if (coveredNames.length === 0) return soloFormats(payerName)
  if (coveredNames.length === 1) return twoPersonFormats(payerName, coveredNames[0]!)
  const all = [payerName, ...coveredNames]
  const joined = all.length <= 2
    ? all.join(' и ')
    : `${all.slice(0, -1).join(', ')} и ${all.at(-1)}`
  return {
    banner: `${payerName} плати {total} за ${joined}`,
    confirmPrompt: `Маркира ${joined} като платени?`,
    toast: `${joined} са маркирани като платени`,
  }
}
```

Wire `{total}` replacement with `formatEur(totalCents)`.

- [ ] **Step 2: Update confirm handler toast**

Use formatted toast with all names from payer + covered IDs.

- [ ] **Step 3: Commit**

```bash
git add src/components/bills/combined-payment-banner.tsx shared/combined-payment-messages.ts
git commit -m "feat: host banner for multi-person combined payments"
```

---

### Task 9: AssignmentRow shared badge (optional polish)

**Files:**
- Modify: `src/components/bills/assignment-row.tsx`

- [ ] **Step 1: Show badge when qty=1 and assignees > 1**

```tsx
{quantity === 1 && assignedParticipantIds.length > 1 ? (
  <Badge variant="secondary">Споделено ({assignedParticipantIds.length})</Badge>
) : null}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bills/assignment-row.tsx
git commit -m "feat: shared item badge on host assignment row"
```

---

### Task 10: E2E tests

**Files:**
- Create: `e2e/guest-item-sharing.spec.ts`
- Modify: `e2e/combined-guest-payment.spec.ts`

- [ ] **Step 1: guest-item-sharing — 3 guests, qty=1 drink**

```ts
// e2e/guest-item-sharing.spec.ts
test('three guests share one qty=1 item with equal split', async ({ browser }) => {
  // Host: 3 participants, 1 item qty=1 €9.00
  // Guest A joins item first
  // Guest B sees share preview, joins
  // Guest C joins
  // Each guest footer shows €3.00 owed for that item (or €3.00/€3.00/€3.00 with remainder)
})
```

Use `.guest-claim-card` locators; assert text `Споделено с` and `Вашият дял`.

- [ ] **Step 2: Extend combined-guest-payment for 3-person pay**

Add test: host creates 3 participants; guest A claims items; guest A selects chips for B and C; Revolut; host confirms; assert all three `платено`.

Update chip interaction: toggle two chips instead of one.

- [ ] **Step 3: Run E2E**

Run: `pnpm exec playwright test e2e/guest-item-sharing.spec.ts e2e/combined-guest-payment.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add e2e/guest-item-sharing.spec.ts e2e/combined-guest-payment.spec.ts
git commit -m "test: e2e for guest item sharing and multi-cover payment"
```

---

### Task 11: Preflight verification

- [ ] **Step 1: Run full preflight**

Run: `pnpm run preflight`
Expected: lint, typecheck, unit tests pass

- [ ] **Step 2: Manual regression checklist**

1. Solo guest Revolut pay still works
2. Pay for one other person still works (regression)
3. Pay for two others — one confirm marks all three paid
4. Shared drink — three phones see correct share preview and totals
5. Covered guest sees notice and cannot pay separately

- [ ] **Step 3: Commit any fixes**

```bash
git commit -m "fix: address preflight issues from guest sharing refactor"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| qty=1 share preview UI | Task 1, 2 |
| qty>1 unit progress copy | Task 2 |
| Multi-select chips | Task 6, 7 |
| `coveredParticipantIds` + snapshots | Task 3, 4, 5 |
| `updateCovered` mutation | Task 5, 7 |
| N-row confirm | Task 5 |
| Legacy `coveredParticipantId` reads | Task 3, 5 |
| Host banner N names | Task 8 |
| AssignmentRow badge | Task 9 |
| E2E sharing + multi-pay | Task 10 |
| Scrollable chips | Task 6 |
| Block chip changes after Revolut | Task 3, 7 |

## Self-review notes

- `create` now requires non-empty `coveredParticipantIds`; solo path remains `createSolo` — matches spec
- `previewShareCents` uses `splitLineTotal` for cent remainder parity with billing math
- `updateCovered` with empty array delegates to `cancel` — avoids orphan pending rows
- Existing E2E combined test must update chip API from single-select to multi-select
