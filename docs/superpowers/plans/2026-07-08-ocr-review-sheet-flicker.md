# OCR Review Sheet Scroll Flicker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate mobile scroll flicker in the OCR review sheet by removing compositing conflict with the sticky totals bar and fixing sheet opacity.

**Architecture:** Hide the fixed blurred footer while the review sheet is open; render the sheet as a single opaque bottom panel. Tighten empty-state conditions so loading never masquerades as “no items”.

**Tech Stack:** React 19, Radix Sheet, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-07-08-ocr-review-sheet-flicker-design.md`

---

### Task 1: Hide sticky footer during OCR review

**Files:**

- Modify: `src/routes/bills/$billId/index.tsx`

- [ ] **Step 1:** Wrap `StickyTotalsBar` so it only renders when `!reviewSheetOpen`

- [ ] **Step 2:** Run `npm run preflight`

---

### Task 2: Opaque sheet + empty-state guard

**Files:**

- Modify: `src/components/bills/receipt-scan-review-sheet.tsx`

- [ ] **Step 1:** Replace transparent outer `SheetContent` (`bg-transparent`, `mb-16`) with opaque `bg-background` panel covering the bottom safe area

- [ ] **Step 2:** Add `onOpenAutoFocus={(e) => e.preventDefault()}` (consistent with payment settings sheet)

- [ ] **Step 3:** Change empty copy to require `(scanReady.extractedItems?.length ?? 0) === 0`

- [ ] **Step 4:** Run `npm run preflight`

---

### Task 3: Manual QA

- [ ] Upload receipt → scan → scroll item list on mobile — no flicker
- [ ] Close sheet — sticky bar visible again
- [ ] Import still works
