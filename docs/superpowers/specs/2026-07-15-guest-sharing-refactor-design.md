# Guest Sharing Refactor — Multi-Person Items & Payment

**Date:** 2026-07-15  
**Status:** Approved  
**Scope:** Refactor guest claim UX for clearer item sharing (self-serve) and extend combined payment to payer + N others in one transfer  
**Approach:** A — Evolve current claim screen (tabs + sticky footer)  
**Builds on:** `2026-07-07-guest-qr-claim-flow-design.md`, `2026-07-15-combined-guest-payment-design.md`

---

## Problem

Two friction points at the table:

1. **Item sharing is undercommunicated.** Guests can already join equal splits on qty=1 items via tap-to-toggle, but cards do not show who is sharing or what the guest's share would be before joining. The “1L drink split among three people” use case works in the backend but feels opaque in the UI.

2. **Combined payment is capped at two people.** A guest can pay for themselves plus exactly one other participant. Paying for a group (self + girlfriend + friend) requires multiple transfers or manual host coordination.

## Solution

**Item sharing:** Improve `GuestItemRow` with live share previews — show co-claimants, participant count, and the guest's share (actual or preview) on qty=1 items; improve progress clarity on qty>1 unit-claim items. Guests self-serve; host assignment UI unchanged functionally.

**Multi-person payment:** Extend `CombinedPayChips` to multi-select and extend `combinedPaymentRequests` to cover N participants. One Revolut transfer, one host confirmation, N+1 `payments` rows inserted atomically.

**Trust model unchanged:** Revolut/IBAN transfers happen outside the app; host confirms receipt.

## UX decisions

| Topic | Choice |
|-------|--------|
| Item assignment driver | Guest self-serve on claim screen |
| qty=1 items (e.g. 1L drink) | Equal cost split among everyone who joins |
| qty>1 items (e.g. 3 beers) | Unit claiming — guests take whole units via steppers |
| Multi-person payment | One transfer, host confirms once |
| Payer selection | Always includes self; guest picks additional unpaid participants |
| UI approach | Evolve current claim screen (tabs + footer), not a full redesign |
| Host assignment | No functional change; optional “shared (N)” badge polish |

---

## User flow — Item sharing

### Guest (claim screen, qty=1)

1. Guest opens **Остават** tab, sees item card with price.
2. If unclaimed: card shows **„Докоснете, за да отбележите“** (solo claim = full line price).
3. If others already sharing: card shows **„Споделено с {names} ({count} души)“** and **„Вашият дял: €X.XX“** preview = `lineTotal ÷ (assignees + 1)` if guest joins.
4. Guest taps **Присъедини се** (or card) → `assignments.toggle` → even cent-split recalculated for all assignees.
5. Card moves to **Мои** tab; shows actual share from `calculateBillTotals`.

### Guest (claim screen, qty>1)

1. Item shows **„{assigned}/{quantity} разпределени · остават {n}“** and names of other claimants.
2. Guest uses **+/−** stepper to claim whole units (unchanged logic via `assignments.setUnits`).
3. Fully claimed items (`remainingUnits === 0`) greyed out with **„Заето“**.

### Tab behavior (unchanged)

- **Остават:** items the guest has not fully claimed.
- **Мои:** items assigned to the guest (shared or solo).

---

## User flow — Multi-person payment

### Guest (claim footer)

1. Guest claims items; footer shows personal breakdown.
2. **„Плати и за“** row shows multi-select toggle chips for other participants with `remainingCents > 0`.
3. Payer's share always included as a fixed line (not a chip).
4. Guest toggles chips (e.g. Maria, Peter) → per-person amounts listed → **combined total** updates.
5. First chip selected → `combinedPayments.create` with `coveredParticipantIds`. Adding/removing chips → `combinedPayments.updateCovered` on the pending request (recalculates snapshots). Deselecting all → `cancel` → solo pay.
6. Guest taps **Revolut** → copy combined amount → open Revolut with note listing all names.
7. Footer shows **„Чака потвърждение от домакина“**; covered guests see notice and cannot pay separately.
8. Deselecting all chips → cancel pending → solo pay.

### Host (bill summary / step 4)

1. Banner adapts to group size:
   - Solo: **„Иван плати €8.50“**
   - Two: **„Иван плати €21.70 за Иван + Мария“**
   - Three+: **„Иван плати €27.00 за Иван, Мария, Петър“**
2. **Потвърди** → confirm dialog lists all participants → N+1 payment rows inserted.
3. Toast: **„Иван, Мария и Петър са маркирани като платени“**

---

## Item card UI spec

### qty=1 card layout

```
┌─────────────────────────────────────────┐
│ 1L Напитка                        €9.00 │
│ €9.00 × 1                               │
│                                         │
│ 👥 Мария, Петър  (2 души)              │
│ Вашият дял: €3.00                       │
│                                         │
│ [  Присъедини се  ]  or  [  ✓ Ваше  ]  │
└─────────────────────────────────────────┘
```

**Copy rules:**

| State | CTA / hint |
|-------|------------|
| Unclaimed, no others | „Докоснете, за да отбележите“ |
| Others sharing, guest not in | „Присъедини се“ + share preview |
| Guest assigned | Highlighted card, „✓ Ваше“, show actual share |

**Share preview helper:** Pure function in `shared/` or `src/lib/`:

```ts
previewShareCents(lineTotalCents: number, assigneeCount: number, joining: boolean): number
// joining=true → split among assigneeCount + 1
// joining=false → split among assigneeCount (actual share)
```

Uses existing `splitLineTotal` from `shared/bill-calculations.ts`.

### qty>1 card layout

- Keep stepper UI.
- Add clearer progress: **„2/3 разпределени · остават 1“**.
- Show other claimant names when present.

---

## Data model

### `combinedPaymentRequests` (extended)

```
combinedPaymentRequests: {
  billId: Id<"bills">
  payerParticipantId: Id<"participants">
  coveredParticipantId?: Id<"participants">   // legacy — read-only after migration
  coveredParticipantIds: Id<"participants">[] // NEW — empty = solo
  payerAmountCents: number
  coveredAmountCents: number                    // SUM of all covered shares
  coveredAmountsByParticipant?: Record<string, number>  // optional snapshot map for confirm
  totalCents: number
  status: "pending" | "confirmed" | "rejected" | "cancelled"
  guestSessionId: Id<"guestSessions">
  createdAt: number
  transferInitiatedAt?: number
  resolvedAt?: number
}
```

**Migration:** Existing rows with `coveredParticipantId` treated as `coveredParticipantIds: [id]` in read paths. New writes use array only.

**Alternative considered:** Child table `combinedPaymentCovers`. Rejected for this scope — array is sufficient for ≤50 participants and keeps confirm logic simple.

**Snapshot strategy:** Store `coveredAmountsByParticipant: Record<participantId, cents>` at create time so confirm can validate and insert one payment row per covered person without recomputing splits. `coveredAmountCents` = sum of map values. `totalCents` = `payerAmountCents + coveredAmountCents`.

---

## Backend API changes

### `combinedPayments.create` (updated)

**Args:** `billId`, `shareToken`, `sessionToken`, `coveredParticipantIds: Id<"participants">[]`

**Validation:**
- Active guest session via `requireGuestSession`
- Share token matches bill
- `coveredParticipantIds` must not include payer
- No duplicates in array
- Each covered ID belongs to bill
- Payer and each covered participant have `remainingCents > 0`
- No existing `pending` request for this `guestSessionId` on this bill
- Each covered participant has no other `pending` request covering them on this bill

**Effect:** Insert request with snapshotted `payerAmountCents`, `coveredAmountsByParticipant`, `coveredAmountCents` (sum), `totalCents`, `status: "pending"`.

**Solo:** `coveredParticipantIds: []` — unchanged solo path via `createSolo`.

### `combinedPayments.updateCovered` (new guest mutation)

**Args:** `billId`, `sessionToken`, `requestId`, `coveredParticipantIds: Id<"participants">[]`

**Validation:** Same as `create` for the new covered set; request is `pending` and belongs to caller's session; `transferInitiatedAt` must be null (cannot change selection after Revolut opened).

**Effect:** Patch request with new `coveredParticipantIds`, `coveredAmountsByParticipant`, `coveredAmountCents`, `totalCents`.

### `combinedPayments.confirm` (updated)

**Validation:**
- Request is `pending`, `transferInitiatedAt` set
- Snapshotted `payerAmountCents` ≤ payer's current remaining
- For each entry in `coveredAmountsByParticipant`: amount ≤ that participant's current remaining
- Each amount passes `validatePaymentAdd` caps

**Effect (atomic):**
- Insert `payments` row for payer
- Insert `payments` row for each covered participant (individual snapshotted amounts)
- Set request `status: "confirmed"`, `resolvedAt: now`
- `touchBill`

### `combinedPayments.getPendingCoverForGuest` (updated)

Return cover info if **any** pending request includes this guest's `participantId` in `coveredParticipantIds` (or legacy `coveredParticipantId`).

### Queries unchanged in shape

- `getPendingForGuest` — returns pending request including `coveredParticipantIds`
- `listPendingForBill` — host banner source

### Shared validation (`shared/combined-payment.ts`)

Extend:
- `validateCombinedPaymentCreate` → accept `coveredParticipantIds: string[]`
- `validateCombinedPaymentConfirm` → accept map of covered amounts vs remainings
- `isSoloPaymentRequest` → `coveredParticipantIds.length === 0 && !coveredParticipantId`

---

## Guest UI — `GuestItemRow`

**Changes:**
- Compute share preview using assignee count from `itemAssignments`
- Show co-claimant names via existing `getOtherClaimantLabels`
- Distinct visual for shared vs solo (badge or subtitle)
- CTA copy: „Присъедини се“ when others present, „Докоснете, за да отбележите“ when unclaimed

**No backend changes** for item assignment.

---

## Guest UI — `CombinedPayChips` + `GuestClaimFooter`

**`CombinedPayChips` changes:**
- `selectedCoveredId: Id | null` → `selectedCoveredIds: Id[]`
- `onSelect(id | null)` → `onToggle(id)` — toggle chip in/out of set
- Multi-select visual (filled = selected)

**`GuestClaimFooter` changes:**
- Track `selectedCoveredIds` array
- Show per-person breakdown lines when combined
- Combined total = payer remaining + sum of selected covered remainings
- `handleSelectCovered` → `handleToggleCovered` — create on first select, `updateCovered` on subsequent toggles, `cancel` when selection empty
- Revolut note: all participant names in group
- Chips in scrollable row when >6 others (`overflow-x-auto flex-nowrap`)

---

## Host UI

### `CombinedPaymentBanner`

- Format banner for 1, 2, or 3+ covered names
- Confirm dialog lists all participants being marked paid
- Success toast with joined names

### `AssignmentRow` (optional polish)

- Show **„Споделено ({n})“** badge when multiple assignees on qty=1 item
- No mutation changes

---

## Edge cases

| Case | Behavior |
|------|----------|
| Guest joins shared qty=1 item | Even cent-split recalculated for all assignees (existing `toggle` + `syncEvenAssignments`) |
| Solo claim on unclaimed qty=1 | Guest pays full line until others join |
| qty>1 fully claimed | Card unavailable (`isUnavailableToMe`) |
| Covered person paid before confirm | Confirm fails for that participant |
| Assignments change after pending | Confirm re-validates snapshotted amounts; may fail |
| Change chips after Revolut opened | Blocked — must cancel pending first |
| Two guests pay for same person | Second create rejected |
| Guest selects person with €0 remaining | Chip disabled or error on toggle |
| 10+ unpaid participants | Scrollable chip row; only show `remainingCents > 0` |
| Legacy pending requests | Read via `coveredParticipantId` fallback |
| Finalized bill | Same rules as current combined pay |

---

## Known issues (out of scope)

1. **`assignments.toggle` resyncs even split on qty>1** — host toggle wipes unit allocations. Guests use `setUnits` for qty>1; not addressed in this refactor.
2. **Footer crowding** — mitigated by scrollable chips, not a separate payment sheet.

---

## Out of scope

- Custom/un-equal item splits (percentages, arbitrary amounts)
- Host-driven shared item setup (guest self-serve only)
- Pay for others without including self
- Cross-bill combined payment
- Auto-confirm without host
- Integrated payment processor

---

## Testing

### Unit (Vitest)

- Share preview helper: 1, 2, 3 assignees; cent remainder distribution
- `validateCombinedPaymentCreate` with 0, 1, 3 covered IDs
- `validateCombinedPaymentConfirm` with per-participant amount map
- Legacy `coveredParticipantId` read compatibility
- `getPendingCoverForGuest` with array covers

### E2E (Playwright)

- 3 guests share qty=1 item → each sees correct equal share in footer
- Guest pays for self + 2 others → one Revolut flow → host confirms → 3 payment rows
- Covered guests blocked from paying while pending
- Guest cancels combined selection → chips re-enabled
- Multi-select deselect all → solo pay restored

### Manual

- IBAN-only host with 3-person combined pay
- Partial payments then combined pay for remainder
- Bill with 8+ participants — chip row scrolling

---

## Files (expected touch points)

| Area | Files |
|------|-------|
| Schema | `convex/schema.ts` |
| API | `convex/combinedPayments.ts` |
| Shared validation | `shared/combined-payment.ts`, `shared/combined-payment-messages.ts` |
| Shared preview | `shared/guest-share-preview.ts` (new) or `src/lib/guest-share-preview.ts` |
| Guest item UI | `src/components/bills/guest-item-row.tsx` |
| Guest pay UI | `src/components/bills/combined-pay-chips.tsx`, `src/components/bills/guest-claim-footer.tsx` |
| Host UI | `src/components/bills/combined-payment-banner.tsx` |
| Optional polish | `src/components/bills/assignment-row.tsx` |
| Tests | `shared/combined-payment.test.ts`, `shared/guest-share-preview.test.ts`, `e2e/combined-guest-payment.spec.ts`, new `e2e/guest-item-sharing.spec.ts` |

---

## Verification

- `pnpm run preflight`
- Manual: 3-person table — share drink, one person pays for all three
- Regression: existing solo pay and pay-for-one flows still work
