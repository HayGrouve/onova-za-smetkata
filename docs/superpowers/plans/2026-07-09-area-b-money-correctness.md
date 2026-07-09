# Area B — Money Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Single source of truth for bill money math; dashboard/summary parity; split-semantics fixes.

**Architecture:** `shared/bill-calculations.ts` imported by client (`src/lib`) and Convex (`convex/lib`); assignment write-path normalization for cent vs unit modes.

**Tech Stack:** TypeScript, Convex, Vitest

**Spec:** `docs/superpowers/specs/2026-07-09-area-b-money-correctness-design.md`

**Status:** ✅ Complete (2026-07-09)

---

## Phase B1 — Consolidation

- [x] Create `shared/bill-calculations.ts` + re-exports
- [x] Replace `listWithSummary` inline math with `calculateBillTotals`
- [x] Thin `validateBillForFinalize` wrapper; `ConvexError` in `assertBillCanFinalize`
- [x] Delete `convex/lib/splitUnits.ts`

## Phase B2 — Tests & payments

- [x] Reconciliation + edge-case tests in `bill-calculations.test.ts`
- [x] `totalOutstandingCents` helper
- [x] `payments.add` validation (participant on bill, positive amount, no overpay)

## Phase B3 — Split semantics

- [x] `syncEvenAssignments` qty=1 cent-split (no units)
- [x] `normalizeItemAssignmentModes` on setUnits
- [x] Block quantity decrease when assigned units exceed new qty
- [x] `backfill:normalizeAssignmentModes`

## Verification

- [x] `pnpm run preflight`
