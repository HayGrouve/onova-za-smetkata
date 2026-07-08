# App Icons & Payment Row Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Lucide icons across section headers and primary actions, and highlight summary payment rows by status (unpaid red, partial amber, paid none).

**Architecture:** Shared `ICON` size constants in `src/lib/app-icons.ts`; payment border logic in `src/lib/payment-row-styles.ts` with unit tests. Icons added inline at each call site following existing Shadcn + Lucide patterns.

**Tech Stack:** React, Lucide React, Tailwind, Vitest

**Spec:** `docs/superpowers/specs/2026-07-07-icons-payment-highlight-design.md`

---

## File Map

| File                                                    | Responsibility                                                       |
| ------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/lib/app-icons.ts`                                  | `ICON.section`, `ICON.button`, `ICON.header` constants               |
| `src/lib/payment-row-styles.ts`                         | `getPaymentRowBorderClass(status)`                                   |
| `src/lib/payment-row-styles.test.ts`                    | Border class unit tests                                              |
| `src/components/bills/payment-row.tsx`                  | Apply border classes + copy hint icon                                |
| `src/components/bills/payment-actions.tsx`              | Check / Coins on payment buttons                                     |
| `src/components/bills/participant-pay-actions.tsx`      | Send on Revolut                                                      |
| `src/components/bills/payment-settings-sheet.tsx`       | Wallet title, Copy, Save                                             |
| `src/components/bills/payment-settings-open-button.tsx` | Wallet on full-width button                                          |
| `src/components/bills/item-list.tsx`                    | AlertTriangle badge, Plus add                                        |
| `src/components/bills/participant-list.tsx`             | UserPlus on add                                                      |
| `src/components/bills/bill-card.tsx`                    | Trash on delete actions                                              |
| `src/components/bills/sticky-totals-bar.tsx`            | PieChart on breakdown title                                          |
| `src/components/bills/receipt-preview-card.tsx`         | Receipt on card title                                                |
| `src/routes/index.tsx`                                  | (unchanged — icons already on Plus/Search; settings via open button) |
| `src/routes/bills/$billId/index.tsx`                    | Receipt, ScanLine, Users, ShoppingBag                                |
| `src/routes/bills/$billId/summary.tsx`                  | Section + action icons                                               |
| `src/routes/__root.tsx`                                 | RefreshCw on error retry                                             |

---

### Task 1: Shared utilities and tests

**Files:**

- Create: `src/lib/app-icons.ts`
- Create: `src/lib/payment-row-styles.ts`
- Create: `src/lib/payment-row-styles.test.ts`

- [x] **Step 1:** Add `ICON` constants and `getPaymentRowBorderClass`
- [x] **Step 2:** Run `npm test` — 38 tests pass

---

### Task 2: Payment row highlight

**Files:**

- Modify: `src/components/bills/payment-row.tsx`

- [x] **Step 1:** Apply `getPaymentRowBorderClass(totals.status)` via `cn()`
- [x] **Step 2:** Add small `CopyIcon` next to „Остатък“ when tappable

---

### Task 3: Payment and settings components

**Files:**

- Modify: `payment-actions.tsx`, `participant-pay-actions.tsx`, `payment-settings-sheet.tsx`, `payment-settings-open-button.tsx`

- [x] **Step 1:** Add icons per spec map
- [x] **Step 2:** Run `npm test`

---

### Task 4: Editor and list components

**Files:**

- Modify: `item-list.tsx`, `participant-list.tsx`, `bill-card.tsx`, `sticky-totals-bar.tsx`, `receipt-preview-card.tsx`

- [x] **Step 1:** Add section/action icons
- [x] **Step 2:** Run `npm test`

---

### Task 5: Route pages

**Files:**

- Modify: `src/routes/bills/$billId/index.tsx`, `summary.tsx`, `__root.tsx`

- [x] **Step 1:** Card title and button icons
- [x] **Step 2:** Run `npm test` and `npm run preflight` if desired

---

## Verification

Run: `npm test`  
Expected: all tests pass including `payment-row-styles.test.ts`

Manual: open summary with mixed payment statuses — unpaid rows red left border, partial amber, paid plain.
