# Area C — Guest & Payment UX Implementation Plan

**Goal:** Close UX-1–UX-7 — guest/payment UX through equal split, confirmations, payment undo, claim tabs.

**Spec:** `docs/superpowers/specs/2026-07-09-area-c-guest-payment-ux-design.md`

**Status:** ✅ Complete (2026-07-09)

---

## Wave 1 — UX-1, UX-2, UX-3

- [x] **UX-1:** `getForGuest` returns `iban`; guest footer Revolut + IBAN copy
- [x] **UX-2:** Hide edit on final; badge `Завършена — само преглед`
- [x] **UX-3:** `min-h-11 min-w-11` on assignment/payment controls; `aria-pressed` on chips

## Wave 2 — UX-4, UX-5, UX-6, UX-7

- [x] **UX-4:** `assignEven` + per-item and bill-level equal-split buttons
- [x] **UX-5:** Finalize confirmation dialog; delete „Отказ“ on summary + bill card
- [x] **UX-6:** Payment history list + `payments.undoLast`
- [x] **UX-7:** Claim tabs „Остават“ / „Мои“; qty=1 cent-split selection fix

## Verification

- [x] `pnpm run preflight`

## Deferred

- [x] UX-8: Offline messaging alignment
- [x] UX-9: A11y + i18n polish pass
