# Area E — Architecture & Scalability (Scoped Design)

**Date:** 2026-07-09  
**Status:** ✅ Implemented (2026-07-09)  
**Parent audit:** `docs/superpowers/specs/2026-07-08-application-audit.md`  
**Findings covered:** ARC-1 through ARC-5 (ARC-6 deferred)

---

## Summary

Reduces home-page query cost, caps recent-name lookup, centralizes list-summary math, extracts receipt-scan orchestration, and hardens assignment upserts against duplicates.

---

## ARC-1 — Denormalized bill list summaries

- Added `listBillTotalCents`, `listOutstandingCents`, `listParticipantNames` on `bills`.
- `convex/lib/billListSummary.ts` — `loadBillRelations`, `buildListSummaryFields`, `computeBillListSummary`.
- `touchBill` refreshes summary fields on every bill mutation.
- `bills.listWithSummary` reads denormalized fields (O(1) per bill); optional `limit` (default 100, max 200).
- Backfill: `npx convex run backfill:refreshBillListSummaries` once after schema deploy.

## ARC-2 — Cap `listRecentNames` scan

- `participants.listRecentNames` scans at most **24** recent bills instead of all bills.

## ARC-3 — Thin `bills.ts`

- List-summary math moved to `convex/lib/billListSummary.ts`; `bills.ts` delegates.

## ARC-4 — Receipt scan hook

- `src/hooks/use-receipt-scan.ts` — upload, scan lifecycle, pre-scan/replace dialogs state.
- `src/routes/bills/$billId/index.tsx` consumes the hook.

## ARC-5 — Assignment dedupe

- Compound index `itemAssignments.by_itemId_participantId`.
- `assignments.setUnits` upserts via compound index instead of blind insert.
- Optional backfill: `npx convex run backfill:dedupeAssignments`.

## ARC-6 — Deferred

Audit log, soft deletes, and multi-currency remain out of scope until product needs them.

---

## Verification

- `src/lib/bill-list-summary.test.ts` — `buildListSummaryFields` draft/final cases.
- `pnpm run preflight`
- After deploy: `npx convex run backfill:refreshBillListSummaries` on dev and prod.
