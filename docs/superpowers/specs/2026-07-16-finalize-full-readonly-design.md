# Finalize Full Read-Only — Design Spec

**Date:** 2026-07-16  
**Status:** Draft  
**Scope:** After host taps **Завърши сметка** (`bill.status === 'final'`), the bill is hard read-only for every mutating action; delete remains allowed  
**Approach:** 2 — Full finalize lock (server + UI), not payments-only  
**Builds on:** Existing `final` status, guest claim `readOnly`, Area C UX-2 edit lock, `payments.undoLast`

---

## Problem

Finalize already locks most bill content (items, participants, guest claims) and shows **Завършена — само преглед**. Gaps remain:

1. Host can still **add / undo payments** on summary and participant detail.
2. Server does not reject `payments.add` / `payments.undoLast` when `status === 'final'`.
3. Other mutators (e.g. `bills.update`, `bills.rotateShareToken`, combined-payment flows) may still accept writes on finalized bills.

A finalized bill is not truly read-only.

## Goal

When `bill.status === 'final'`, treat the bill as **hard read-only** for host and guest mutating paths. View, share/copy, and **delete bill** stay available.

---

## Decisions

| Topic | Choice |
|-------|--------|
| When lock applies | After **Завърши сметка** only (`status === 'final'`) — not “everyone paid” |
| Depth | Full lock (server + UI), not UI-only |
| Delete | Still allowed (`bills.remove`) |
| Share / copy / view detail | Allowed (non-mutating) |
| Rotate share token | Blocked on final |
| Error copy | Reuse *„Сметката е приключена и не може да се редактира.“* |

---

## Allowed vs blocked

| Allowed after finalize | Blocked after finalize |
|------------------------|------------------------|
| View summary / claim (read-only) | Payments: mark paid, partial, undo |
| Share / copy amounts | Items, participants, assignments, tip, restaurant, note, date |
| Open participant detail (view only) | Receipt scan / import |
| Delete bill (`Изтрий`) | Friend-group add-to-bill, rotate share token |
| | Combined-payment mutations that change bill payment state |
| | Any other bill-scoped content mutation found in audit |

---

## Architecture

### Server — source of truth

Add a shared helper, e.g. `assertBillDraft(bill)` in `convex/lib/`, that throws `ConvexError` with the existing finalize message when `status === 'final'`.

Call it from every remaining bill-mutating mutation that does not already guard, including at least:

- `payments.add` / `payments.undoLast`
- `bills.update` / `bills.rotateShareToken`
- `combinedPayments.*` mutators that create/update/confirm/cancel payment state for a bill
- Any other bill-scoped mutator found during implementation audit

Already-guarded paths (items, participants, assignments, receipt scan, friend-group add) may keep inline checks or switch to the helper for one message.

**Explicitly not guarded by draft-only:** `bills.remove` (delete), queries, and session heartbeat/release needed for viewing.

### UI

When `status === 'final'`:

- Hide `PaymentActions` on summary `PaymentRow` and participant detail (`showPaymentActions` only when draft and not host seat).
- Payment history may remain visible for audit; no undo / mark-paid / partial controls.
- Editor already forces step 4 and passes `readOnly` on lists; ensure tip/restaurant/advanced fields cannot save if somehow reached (UI disabled + server `bills.update` guard).
- Invite card: disable rotate-link on final; view/copy share URL OK.
- Finalize confirm copy: mention that after finishing, payments cannot be changed either (guests already locked).

### Out of scope

- Auto-finalize when everyone is paid
- Locking on “all paid” before finalize
- Changing delete confirmation UX beyond keeping delete available
- New bill statuses or unlock/re-open flow

---

## Testing

**Unit**

- Helper: `draft` passes; `final` throws expected message.

**Manual / e2e**

- Extend or add e2e: after finalize, host summary has no undo / mark-paid; delete still works.
- Existing guest claim read-only e2e remains green.

**Success criteria**

1. Finalized bill: no payment add/undo in UI.
2. Server rejects payment mutate, bill update, and rotate token on `final`.
3. Delete still works.
4. Guest/host claim read-only behavior unchanged.
5. Finalize dialog mentions payment lock (light copy update).

---

## Files (expected)

| Area | Likely touch |
|------|----------------|
| `convex/lib/assertBillDraft.ts` (new) + test | Shared guard |
| `convex/payments.ts`, `convex/bills.ts`, `convex/combinedPayments.ts`, audit others | Call guard |
| `src/components/bills/payment-row.tsx` / `bill-summary-content.tsx` / detail sheet | Hide payment actions when final |
| `src/components/bills/bill-invite-card.tsx` | Disable rotate on final |
| Finalize dialog copy in `bill-summary-content.tsx` | Payment lock mention |
| `e2e/final-readonly.spec.ts` (or sibling) | Host payment lock + delete |

---

## Open questions

None — decisions settled in brainstorming.
