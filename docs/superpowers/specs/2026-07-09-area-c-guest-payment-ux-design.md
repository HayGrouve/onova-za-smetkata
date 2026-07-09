# Area C — Guest & Payment UX (Scoped Design)

**Date:** 2026-07-09  
**Status:** ✅ Implemented (2026-07-09) — Wave 1 + Wave 2  
**Parent audit:** `docs/superpowers/specs/2026-07-08-application-audit.md`  
**Findings covered:** UX-1 through UX-7 (UX-8/9 deferred)  
**Prerequisite:** Area A complete (SEC-4 share tokens gate guest payment details)

---

## Summary

**Area C** closes guest/payment UX friction. **Wave 1** (UX-1–UX-3): IBAN for guests, finalize edit lock, 44px touch targets. **Wave 2** (UX-4–UX-7): equal-split shortcuts, finalize confirm, payment undo, claimed-items tabs.

**Deferred:** UX-8 (offline), UX-9 (a11y polish) — ✅ Done (2026-07-09).

---

## Wave 1 (UX-1–UX-3) — ✅

See git history / prior spec revision for IBAN, edit lock, touch targets.

---

## Wave 2 (UX-4–UX-7) — ✅

### UX-4 — Equal split shortcut

- **Backend:** `assignments.assignEven({ itemId })` — even split among all participants; `assignAll` guarded on final bills.
- **UI:** Per-item „Раздели поравно“ in `assignment-row.tsx`; bill-level „Раздели поравно неразпределените“ in `item-list.tsx` (`mode: unassigned_only`).

### UX-5 — Finalize confirm + delete Cancel

- **Finalize:** Confirmation dialog on summary — total, unpaid count, guest lock explanation; explicit „Отказ“.
- **Delete:** „Отказ“ added to delete dialogs in `summary.tsx` and `bill-card.tsx`.

### UX-6 — Payment history + undo

- **Backend:** `payments.undoLast({ billId, participantId })` — removes most recent payment for participant.
- **UI:** `PaymentActions` shows payment log + „Отмени последно плащане“; wired from summary `PaymentRow` / detail sheet.

### UX-7 — Claimed items visible

- **Logic:** `filterClaimedGuestClaimItems`; fixed `getGuestClaimItemState` for qty=1 cent-split (assignment presence, not `units`).
- **UI:** Guest claim tabs „Остават (N)“ / „Мои (M)“ with search on both.

---

## Verification

- `pnpm run preflight`
- Manual: equal-split on item + unassigned batch; finalize confirm; undo payment; claim tabs after selecting items
