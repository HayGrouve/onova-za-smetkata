# Area D — Data Lifecycle & Correctness (Scoped Design)

**Date:** 2026-07-09  
**Status:** ✅ Implemented (2026-07-09)  
**Parent audit:** `docs/superpowers/specs/2026-07-08-application-audit.md`  
**Findings covered:** LIF-1 through LIF-4

---

## Summary

Closes auxiliary-table growth, payment correction path, silent mutation no-ops, and money/index hygiene.

---

## LIF-1 — Scheduled cleanup

- `convex/cleanup.run` internal mutation purges (batched): expired guest sessions, stale rate-limit buckets (>2h), terminal receipt scans (>30 days).
- `convex/crons.ts` runs every 6 hours.
- `bills.finalize` also purges guest sessions for the bill.

## LIF-2 — Payment correction

- Satisfied by UX-6 `payments.undoLast` (owner-only, removes latest payment per participant).

## LIF-3 — Throw, don't no-op

- `assignments` toggle/setUnits/assignEven throw `ConvexError` when item/bill missing.
- `items` update/remove throw when item missing.
- `participants.remove` throws when participant missing.
- `payments.add` already validates participant on bill (Area B).

## LIF-4 — Money validators & indexes

- `convex/lib/money.ts` — `assertNonNegativeIntCents`, `assertPositiveIntCents`, `assertPositiveQuantity`.
- Applied on `items.add/update`, `payments.add`, `bills.update` (tip).
- Removed unused `bills.by_status` index.
- Added `payments.by_participantId`; `participants.remove` uses it.

---

## Verification

- `pnpm run preflight`
- After deploy: Convex crons register automatically; optional `npx convex run cleanup:run` on dev
