# Receipt Storage Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Delete Convex receipt image files when a bill is removed or its receipt photo is replaced.

**Architecture:** Shared helpers in `convex/lib/receiptStorage.ts`; wired into `bills.remove` and `bills.update`.

**Spec:** `docs/superpowers/specs/2026-07-07-receipt-storage-cleanup-design.md`

---

### Task 1: Receipt storage helpers

- [x] Create `convex/lib/receiptStorage.ts` with scan cleanup, storage delete, replace guard
- [x] Add `src/lib/receipt-storage.test.ts` for `shouldDeleteReplacedReceiptStorage`

### Task 2: Wire bill mutations

- [x] `bills.update` — patch first, then cleanup old storage + scans on replace
- [x] `bills.remove` — delete scans, cascade, delete bill, delete storage file

### Task 3: Verify

- [x] Run `npm test`
