# Combined Guest Payment — Pay for Two (Scoped Design)

**Date:** 2026-07-15  
**Status:** Approved  
**Scope:** Guest pays their share plus one other participant on the same bill; host confirms once  
**Approach:** A — Expanded footer (chips in `GuestClaimFooter`)

---

## Problem

A guest on the claim screen can only pay their own share via Revolut/IBAN. In practice, one person often pays for themselves and a partner (e.g. girlfriend) in a single bank transfer. Today that requires two separate transfers or manual coordination, and the host must mark each participant paid individually.

## Solution

Extend the guest claim footer with a **“Pay for”** chip row. The guest selects one other unpaid participant, sees a combined total, and sends one Revolut transfer. The app creates a **pending combined payment request**. The host sees a banner on the bill summary and confirms once — both participants are marked paid atomically.

**Trust model unchanged:** Revolut/IBAN transfers happen outside the app. The host still confirms money was received (same as today), but one confirmation covers both shares.

## UX decisions

| Topic | Choice |
|-------|--------|
| Scope | Same bill only; payer's share + exactly one other participant |
| Actor | Guest initiates payment; host confirms |
| Second person | Guest picks from unpaid participants on the bill (chip selection) |
| UI placement | Chips + combined total in existing `GuestClaimFooter` (no new screens) |
| Solo pay | Unchanged — Revolut without creating a pending request |
| Combined pay | `create` pending request → Revolut with combined amount |
| Host action | Banner on `BillSummaryContent` with Confirm / Reject |
| Recording | `confirm` inserts two `payments` rows in one transaction |

## User flow

### Guest (claim screen)

1. Guest claims items as today; footer shows breakdown and their share.
2. New row **„Плати и за“** shows chips for other participants with `remainingCents > 0`.
3. Guest taps one chip (e.g. Maria) → chip highlights, Maria's remaining appears, **combined total** updates.
4. Guest taps **Revolut** → `combinedPayments.create` → copy combined amount → open Revolut.
5. Footer shows **„Чака потвърждение от домакина“**; Revolut disabled; **„Отмени“** available.
6. Tapping selected chip again deselects → back to solo pay.

### Host (bill summary / step 4)

1. Banner: **„Иван плати €21.70 за Иван + Мария“** with **Потвърди** / **Отхвърли**.
2. **Потвърди** → confirm dialog → both participants marked paid.
3. Banner disappears; guest footer reflects paid state on next load.

## Data model

```
combinedPaymentRequests: {
  billId: Id<"bills">
  payerParticipantId: Id<"participants">
  coveredParticipantId: Id<"participants">
  payerAmountCents: number
  coveredAmountCents: number
  totalCents: number
  status: "pending" | "confirmed" | "rejected" | "cancelled"
  guestSessionId: Id<"guestSessions">
  createdAt: number
  resolvedAt?: number
}
  .index("by_billId_status", ["billId", "status"])
  .index("by_guestSessionId", ["guestSessionId"])
```

Amounts are **snapshotted at creation** and validated again at confirm time against current remaining balances.

## Backend API

### `combinedPayments.create` (guest mutation)

**Args:** `billId`, `shareToken`, `sessionToken`, `coveredParticipantId`

**Validation:**
- Active guest session via `requireGuestSession`
- Share token matches bill
- `coveredParticipantId` belongs to bill and ≠ `payerParticipantId`
- Both payer and covered have `remainingCents > 0` (via `calculateBillTotals`)
- No existing `pending` request for this `guestSessionId` on this bill
- Covered participant has no other `pending` request covering them on this bill

**Effect:** Insert request with `status: "pending"`, snapshotted amounts, `totalCents = payer + covered`.

**Returns:** `{ requestId, totalCents }` for Revolut URL.

### `combinedPayments.cancel` (guest mutation)

**Args:** `billId`, `sessionToken`, `requestId`

**Validation:** Request is `pending` and belongs to caller's guest session.

**Effect:** `status: "cancelled"`, `resolvedAt: now`.

### `combinedPayments.confirm` (host mutation)

**Args:** `billId`, `requestId`

**Validation:**
- `requireBillOwner`
- Request is `pending` on this bill
- Snapshotted `payerAmountCents` ≤ payer's current remaining
- Snapshotted `coveredAmountCents` ≤ covered's current remaining
- Both amounts pass `validatePaymentAdd` caps

**Effect (atomic):**
- Insert `payments` row for payer (`amountCents: payerAmountCents`, note: optional combined-pay note)
- Insert `payments` row for covered (`amountCents: coveredAmountCents`, same note)
- Set request `status: "confirmed"`, `resolvedAt: now`
- `touchBill`

### `combinedPayments.reject` (host mutation)

**Args:** `billId`, `requestId`

**Validation:** `requireBillOwner`, request is `pending`.

**Effect:** `status: "rejected"`, `resolvedAt: now`.

### Queries

- **`combinedPayments.getPendingForGuest`** — `{ billId, shareToken, sessionToken }` → pending request for footer state (or null).
- **`combinedPayments.listPendingForBill`** — `{ billId }` → pending requests for host banner (`requireBillOwner`).

## Guest UI — `GuestClaimFooter`

Extend existing footer; no new routes.

**New block** between breakdown and total:

```
Плати и за
[Maria ✓] [Ivan] [Peter]
```

- Chips: other participants with `remainingCents > 0` (exclude payer, exclude fully paid).
- Single selection (v1); tap selected chip to deselect.
- When selected: show covered person's remaining below chips.

**Total line:**

| State | Label | Amount |
|-------|-------|--------|
| Solo | „Вашият дял“ / „Остатък“ | payer only |
| Combined | „Общо за плащане“ | payer + covered |

**Revolut button:**
- Solo: current behavior (open Revolut, no DB write).
- Combined: `create` → then Revolut with `totalCents`.

**IBAN:** When host has IBAN only, copy `totalCents` formatted amount + IBAN; still create pending on combined flow.

**Pending state:**
- Chips and Revolut disabled.
- Amber status text + **„Отмени“** calls `cancel`.

**Props change:** Claim page passes full `calculateBillTotals` output (all participants) into footer, not only payer totals.

## Host UI — `BillSummaryContent`

**Location:** Above payment rows on step 4 and `/summary`.

**Pending banner** (stacked if multiple requests):

```
⏳ Иван плати €21.70 за Иван + Мария
   [Потвърди]  [Отхвърли]
```

- **Потвърди** → `useConfirmAction` dialog: „Маркира Иван и Мария като платени?“
- **Отхвърли** → `reject`; toast to host; guest can retry on next visit.

Payment rows unchanged until confirm; existing `PaymentRow` / `PaymentActions` reflect paid state after confirm.

## Edge cases

| Case | Behavior |
|------|----------|
| Covered person paid before confirm | Confirm fails: „Дялът на {name} вече е платен“ |
| Payer share changed since create | Confirm validates at click; reject if snapshotted amount exceeds remaining |
| Guest closes app with pending | Pending persists; footer restores on return via `getPendingForGuest` |
| Two guests pay for same person | Second `create` rejected: „Вече има чакащо плащане за този участник“ |
| Host manually marks one paid while pending | Confirm re-validates; may fail for that participant |
| Finalized bill | Combined pay allowed (same as current `payments.add`) |
| Guest session expires | Pending remains; guest cannot cancel until session re-established |
| Solo Revolut after pending cancelled | Works as today |

## Out of scope (v1)

- Pay for 2+ other participants
- Cross-bill combined payment
- Auto-confirm without host action
- Integrated payment processor / webhooks
- Guest-visible payment history for covered participant

## Testing

### Unit (Vitest)

- `create` validation: session, amounts, dedup, participant ownership
- `confirm` atomicity and `validatePaymentAdd` cap enforcement
- `cancel` / `reject` state transitions
- Shared amount helpers if extracted to `shared/`

### E2E (Playwright)

- Guest selects Maria → Revolut → host sees banner → confirm → both paid
- Guest cancels pending → banner gone, chips re-enabled
- Host rejects → guest can create new request

### Manual

- Partial pay then combined pay
- IBAN-only host settings
- Finalized bill with combined pay
- Multiple pending requests from different guests

## Files (expected touch points)

| Area | Files |
|------|-------|
| Schema | `convex/schema.ts` |
| API | `convex/combinedPayments.ts` (new) |
| Guest UI | `src/components/bills/guest-claim-footer.tsx`, `src/routes/bills/$billId/claim.tsx` |
| Host UI | `src/components/bills/bill-summary-content.tsx` |
| Shared | `shared/combined-payment-schema.ts` (new, if validation extracted) |
| Tests | `convex/combinedPayments.test.ts`, `e2e/combined-guest-payment.spec.ts` |

## Verification

- `pnpm run preflight`
- Manual guest + host flow on dev bill with 3+ participants
