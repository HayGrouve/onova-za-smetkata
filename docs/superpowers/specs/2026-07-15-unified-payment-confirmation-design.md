# Unified Payment Confirmation — Solo + Combined Guest Payments

**Date:** 2026-07-15  
**Status:** Approved  
**Scope:** Host confirms all guest-initiated Revolut/IBAN transfers from one stacked list on bill step 4  
**Approach:** A — Extend `combinedPaymentRequests` with optional covered participant and `transferInitiatedAt`

---

## Problem

Today, combined guest payments create a pending request the host can confirm from a banner on step 4. Solo guest payments (Revolut/IBAN for own share only) create **no server-side signal** — the host must scroll through participant rows and manually tap **Платено** for each person.

At a table with multiple guests paying, this splits the host workflow:
- Combined pay → banner at top
- Solo pay → buried in per-participant rows

Additionally, combined requests are created on **chip select**, so the host can see a confirmation banner before the guest has actually opened Revolut. The guest's "transfer initiated" state is client-only (`transferInitiated` in React state).

## Solution

Unify solo and combined guest payments under one pending-request model. The host sees a **stacked list of confirmation cards** at the top of the payments section on step 4 (and `/summary`). Each card represents one guest transfer the host can confirm or reject with a single tap.

A new `transferInitiatedAt` timestamp gates host visibility: the host only sees requests where the guest has opened Revolut or copied IBAN with amount.

Combined chip selection still creates a pending request immediately (so the covered guest sees a notice), but the host banner waits until transfer is initiated.

## UX decisions

| Topic | Choice |
|-------|--------|
| Host layout | Stacked confirmation cards at top of payments card (option A) |
| Bulk confirm | Out of scope for v1 |
| Solo pay | Creates pending request on Revolut/IBAN tap |
| Combined pay | Create on chip select; `transferInitiatedAt` on Revolut/IBAN tap |
| Covered guest notice | Unchanged — appears on chip select (before transfer) |
| Confirm action | Solo → 1 `payments` row; combined → 2 rows (atomic) |
| Reject / cancel | Unchanged semantics; guest can retry |

## User flows

### Guest — solo pay

1. Guest claims items; footer shows breakdown and their share.
2. Guest taps **Revolut** (or copies IBAN with amount).
3. `combinedPayments.createSolo` inserts pending request with `transferInitiatedAt = now`.
4. Footer shows **„Чака потвърждение от домакина“**; Revolut/IBAN disabled; **„Отмени“** available.
5. Host confirms → guest sees paid state on next load.

### Guest — combined pay

1. Guest selects **„Плати и за“** chip → `combinedPayments.create` (no `transferInitiatedAt`).
2. Covered guest sees banner: **„{payer} ще плати и за вас ({amount})“**.
3. Guest taps **Revolut** (or IBAN) → `combinedPayments.initiateTransfer` sets `transferInitiatedAt`.
4. Payer footer shows pending status; Revolut/IBAN disabled; **„Отмени“** available.
5. Host confirms → both participants marked paid atomically.

### Host — step 4 / summary

1. Payments card shows stacked banners for all requests where `status === 'pending'` and `transferInitiatedAt` is set.
2. **Solo card:** `Иван плати €10.50` → **Потвърди** / **Отхвърли**.
3. **Combined card:** `Петър плати €21.70 за Петър + Мария` → **Потвърди** / **Отхвърли**.
4. Multiple guests → multiple cards stacked; host confirms each independently.
5. Participant rows below reflect paid state after each confirm.

## Data model

Extend existing `combinedPaymentRequests` table (no rename in v1):

```
combinedPaymentRequests: {
  billId: Id<"bills">
  payerParticipantId: Id<"participants">
  coveredParticipantId?: Id<"participants">   // absent = solo payment
  payerAmountCents: number
  coveredAmountCents: number                 // 0 for solo
  totalCents: number                         // payerAmountCents for solo
  status: "pending" | "confirmed" | "rejected" | "cancelled"
  guestSessionId: Id<"guestSessions">
  createdAt: number
  transferInitiatedAt?: number               // set on Revolut/IBAN tap
  resolvedAt?: number
}
  .index("by_billId_status", ["billId", "status"])
  .index("by_guestSessionId", ["guestSessionId"])
```

**Solo request:** `coveredParticipantId` absent, `coveredAmountCents = 0`, `totalCents = payerAmountCents`, `transferInitiatedAt` set at creation.

**Combined request:** `coveredParticipantId` present, amounts snapshotted at chip-select create, `transferInitiatedAt` set on transfer tap.

Amounts are snapshotted at creation and re-validated at confirm time against current remaining balances.

## Backend API

### `combinedPayments.create` (guest mutation) — combined only

**Args:** `billId`, `shareToken`, `sessionToken`, `coveredParticipantId`

**Unchanged validation** from existing combined flow:
- Active guest session
- `coveredParticipantId` required and ≠ payer
- Both have `remainingCents > 0`
- No existing pending for session; covered has no other pending

**Effect:** Insert pending request without `transferInitiatedAt`.

### `combinedPayments.createSolo` (guest mutation) — new

**Args:** `billId`, `shareToken`, `sessionToken`

**Validation:**
- Active guest session via `requireGuestSession`
- Share token matches bill
- Payer has `remainingCents > 0`
- No existing `pending` request for this `guestSessionId` on this bill

**Effect:** Insert pending request with `payerAmountCents` = payer remaining, `coveredAmountCents = 0`, `totalCents = payerAmountCents`, `transferInitiatedAt = now`.

**Returns:** `{ requestId, totalCents }`.

### `combinedPayments.initiateTransfer` (guest mutation) — new

**Args:** `billId`, `sessionToken`, `requestId`

**Validation:**
- Request is `pending`, belongs to caller's guest session
- `coveredParticipantId` is present (combined only)
- `transferInitiatedAt` not already set

**Effect:** Patch `transferInitiatedAt = now`.

### `combinedPayments.cancel` (guest mutation)

**Unchanged args.** Works for solo and combined pending requests.

### `combinedPayments.confirm` (host mutation)

**Validation:**
- `requireBillOwner`, request is `pending`, `transferInitiatedAt` is set
- Snapshotted amounts pass `validatePaymentAdd` caps against current remaining

**Effect (atomic):**
- **Solo:** Insert 1 `payments` row for payer
- **Combined:** Insert 2 `payments` rows for payer and covered
- Set request `status: "confirmed"`, `resolvedAt: now`
- `touchBill`

### `combinedPayments.reject` (host mutation)

**Unchanged.** Requires `transferInitiatedAt` set (host only sees initiated requests).

### Queries

| Query | Change |
|-------|--------|
| `getPendingForGuest` | Return pending for session regardless of `transferInitiatedAt` (footer + cancel state) |
| `getPendingCoverForGuest` | Unchanged — any pending combined request covering this participant |
| `listPendingForBill` | **Rename behavior:** return `pending` where `transferInitiatedAt != null` (host banners only) |

## Guest UI — `GuestClaimFooter`

### Solo Revolut / IBAN

- On tap: `createSolo` → open Revolut / copy IBAN (existing note logic)
- Pending UI identical to combined post-transfer state
- **Отмени** → `cancel`

### Combined Revolut / IBAN

- Chip select → `create` (unchanged timing for Guest B notice)
- On tap: `initiateTransfer` if not yet initiated → open Revolut / copy IBAN
- Replace local `transferInitiated` state with `pending.transferInitiatedAt != null` from query

### Disabled states

| State | Chips | Revolut/IBAN | Pending message |
|-------|-------|--------------|-----------------|
| Solo, no pending | enabled | enabled | hidden |
| Solo, pending | disabled | disabled | shown |
| Combined, chip only | selected | enabled | hidden (for payer) |
| Combined, transfer initiated | disabled | disabled | shown |

Covered guest: pay buttons disabled when `pendingCover` exists (unchanged).

## Host UI — `PendingPaymentBanner`

Evolve `CombinedPaymentBanner` to handle solo and combined cards.

**Location:** Top of payments card in `BillSummaryContent` (step 4 and `/summary`).

**Solo card:**
```
⏳ Иван плати €10.50
   [Потвърди]  [Отхвърли]
```
Confirm dialog: „Маркира Иван като платен?“

**Combined card:** Existing copy and confirm dialog (unchanged).

Toast on confirm:
- Solo: „Иван е маркиран като платен“
- Combined: „Иван и Мария са маркирани като платени“

## Edge cases

| Case | Behavior |
|------|----------|
| Guest selects chip but never pays | Host sees nothing; Guest B sees notice; payer can cancel |
| Guest opens Revolut then cancels | Request cancelled; guest can retry |
| Two guests pay solo | Two stacked host cards |
| Guest has solo pending, tries combined | Blocked: `pendingExists` |
| Covered paid before combined confirm | Confirm fails with existing message |
| Amount changed since create | Confirm re-validates; may fail |
| Host rejects initiated request | Guest can retry; combined deselects chip |
| Host manually marks paid while pending | Confirm re-validates; may fail |
| Finalized bill | Guest payments and host confirm allowed (unchanged) |

## Out of scope (v1)

- Bulk **Потвърди всички**
- Pay for 2+ other participants
- Rename `combinedPaymentRequests` table
- Auto-confirm without host action
- Guest payment history for covered person

## Testing

| Layer | Coverage |
|-------|----------|
| Unit | `validateSoloPaymentCreate`, solo confirm (1 payment), `initiateTransfer` guards, host query filter |
| E2E | Solo: guest Revolut → host card → confirm → paid |
| E2E | Combined: no host card on chip alone; card after Revolut |
| E2E | Mixed: two solo + one combined → three stacked cards |
| E2E | Cancel solo and combined pending requests |

## Files to touch (implementation reference)

| Area | Files |
|------|-------|
| Schema | `convex/schema.ts` |
| Backend | `convex/combinedPayments.ts`, `convex/lib/combinedPayment.ts`, `shared/combined-payment.ts` |
| Messages | `shared/combined-payment-messages.ts` |
| Guest UI | `src/components/bills/guest-claim-footer.tsx` |
| Host UI | `src/components/bills/combined-payment-banner.tsx` (rename/evolve) |
| Tests | `shared/combined-payment.test.ts`, `e2e/combined-guest-payment.spec.ts`, new solo e2e |

## Relation to prior spec

Builds on `docs/superpowers/specs/2026-07-15-combined-guest-payment-design.md`. That spec intentionally left solo pay without a pending request. This spec closes that gap and fixes the premature host-banner timing for combined pay.
