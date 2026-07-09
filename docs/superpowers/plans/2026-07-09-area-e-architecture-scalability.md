# Area E — Architecture & Scalability Implementation Plan

**Status:** ✅ Complete (2026-07-09)

**Spec:** `docs/superpowers/specs/2026-07-09-area-e-architecture-scalability-design.md`

- [x] ARC-1: Denormalized list summary fields + `touchBill` refresh + backfill
- [x] ARC-2: Cap `listRecentNames` to 24 bills
- [x] ARC-3: Extract `billListSummary.ts`; thin `bills.ts`
- [x] ARC-4: `useReceiptScan` hook; slim bill editor route
- [x] ARC-5: `by_itemId_participantId` index + upsert + dedupe backfill
- [x] ARC-6: Documented as deferred
- [x] `bill-list-summary.test.ts`
- [x] `pnpm run preflight`
