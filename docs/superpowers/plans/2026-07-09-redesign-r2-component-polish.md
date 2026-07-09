# Redesign R2 — Component Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Map every hardcoded amber/emerald color to semantic tokens (accent / success) and apply the `.money` typography to all amounts.

**Architecture:** Pure className changes in components; no logic or markup restructuring. Depends on R1 (tokens `success`, `accent`, `.money` must exist).

**Tech Stack:** Tailwind CSS v4 semantic classes

**Spec:** `docs/superpowers/specs/2026-07-09-redesign-slate-copper-design.md` (§1.3, §5, §7-R2)

**Depends on:** R1 complete

**Status:** ✅ Complete

---

## Task 1: Emerald → success (finalize actions)

**Files:**
- Modify: `src/routes/bills/$billId/summary.tsx:346,390`

- [x] **Step 1: Replace finalize button classes (line ~346)**

```tsx
className="h-11 w-full bg-success text-success-foreground transition-colors hover:bg-success/90 focus-visible:ring-success/30"
```

- [x] **Step 2: Replace confirm-dialog button classes (line ~390)**

```tsx
className="bg-success text-success-foreground hover:bg-success/90"
```

- [x] **Step 3: Verify no emerald remains**

Run: `rg 'emerald-' src/`
Expected: no matches

---

## Task 2: Amber → copper accent (attention states)

**Files:**
- Modify: `src/components/layout/offline-banner.tsx:15`
- Modify: `src/components/bills/item-list.tsx:177`
- Modify: `src/components/bills/assignment-row.tsx:160`
- Modify: `src/components/bills/receipt-scan-review-sheet.tsx:285,307,371`
- Modify: `src/lib/payment-row-styles.ts:5`
- Modify: `src/lib/payment-row-styles.test.ts:11`

- [x] **Step 1: Offline banner**

```tsx
className="sticky top-14 z-40 border-b border-accent-foreground/30 bg-accent px-4 py-2 text-sm text-accent-foreground"
```

- [x] **Step 2: Unassigned item border (`item-list.tsx:177`)**

```tsx
isUnassigned && 'border-l-4 border-accent-foreground',
```

- [x] **Step 3: Assignment hint text (`assignment-row.tsx:160`)**

```tsx
<p className="text-xs font-medium text-accent-foreground">
```

- [x] **Step 4: Receipt review sheet**

Line ~285 (low-confidence row container):

```tsx
row.confidence === 'low' &&
  !(row.checked && errors) &&
  'border-accent-foreground/50 bg-accent/50',
```

Line ~307 (low-confidence badge):

```tsx
className="border-accent-foreground/50 text-accent-foreground"
```

Line ~371 (totals mismatch warning):

```tsx
<p className="text-xs font-medium text-accent-foreground">
```

- [x] **Step 5: Payment row partial status (`payment-row-styles.ts`)**

```ts
if (status === 'partial') return 'border-l-4 border-accent-foreground'
```

Update the matching expectation in `payment-row-styles.test.ts`:

```ts
'border-l-4 border-accent-foreground',
```

- [x] **Step 6: Run tests + verify no amber remains**

Run: `pnpm exec vitest run src/lib/payment-row-styles.test.ts && rg 'amber-' src/`
Expected: tests PASS; no `amber-` matches

---

## Task 3: `.money` on all amounts

Replace `tabular-nums` with `money` (the utility already sets `font-variant-numeric: tabular-nums`) on elements rendering `formatEur(...)` output.

**Files (locate via `rg 'formatEur' src/ -l`):**
- Modify: `src/components/bills/sticky-totals-bar.tsx` (3 spots: total, per-participant, sheet rows)
- Modify: `src/components/bills/item-list.tsx` (item price displays)
- Modify: `src/components/bills/assignment-row.tsx` (per-person amounts)
- Modify: `src/routes/bills/$billId/summary.tsx` (totals, breakdown)
- Modify: `src/components/bills/payment-row.tsx` (owed/paid)
- Modify: `src/components/bills/payment-actions.tsx` (labels with amounts)
- Modify: `src/components/bills/participant-detail-sheet.tsx`
- Modify: `src/components/bills/participant-breakdown-content.tsx`
- Modify: `src/components/bills/guest-claim-footer.tsx` (owed total)
- Modify: `src/components/bills/guest-item-row.tsx`
- Modify: `src/components/bills/receipt-scan-review-sheet.tsx` (footer totals)
- Modify: `src/components/bills/bill-card.tsx` (bill total)

- [x] **Step 1: Apply the class swap**

Pattern — for every element whose text content is a `formatEur(...)` amount:

```tsx
{/* before */}
<p className="font-semibold tabular-nums">{formatEur(totals.billTotalCents)}</p>
{/* after */}
<p className="money font-semibold">{formatEur(totals.billTotalCents)}</p>
```

Where an amount element has no `tabular-nums`, add `money` alongside existing classes. Do **not** apply `.money` to non-monetary numbers (quantities, counts).

- [x] **Step 2: Verify coverage**

Run: `rg 'tabular-nums' src/components/bills src/routes/bills`
Expected: no remaining matches on money elements (quantity-only usages may stay)

---

## Task 4: Button press/hover polish

**Files:**
- Modify: `src/components/ui/button.tsx`

- [x] **Step 1: Add lift + press to the base cva string**

In the base classes of `buttonVariants`, append:

```
hover:-translate-y-px active:translate-y-0 active:scale-[0.98]
```

(Transitions come from the R1 global `button` rule; reduced-motion guard already neutralizes transforms.)

- [x] **Step 2: Visual spot check**

Run dev server; hover/press primary and outline buttons on home and editor. Expected: subtle 250ms lift, 120ms press.

---

## Task 5: Verification

- [x] **Step 1: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

- [x] **Step 2: Manual QA (light + dark)**

1. Finalize button + dialog: green success, readable text
2. Offline banner: copper tint (toggle network off)
3. Unassigned item + partial payment rows: copper left border
4. Receipt review: low-confidence rows copper, invalid rows destructive (VAL-6 styling wins)
5. All amounts render in Plex Mono, aligned in lists
6. Button hover lift feels subtle, not bouncy

- [x] **Step 3: Update plan status to ✅ Complete**

---

## Self-review (spec coverage)

| Spec requirement (§) | Task |
|------------------|------|
| §1.3 finalize/success token usage | Task 1 |
| §1.3 + §5 amber → copper accent | Task 2 |
| §2 `.money` applied to all amounts | Task 3 |
| §3 button hover/press behavior | Task 4 |
| §5 offline banner | Task 2 |

**Next after completion:** R3 — `2026-07-09-redesign-r3-editor-stepper.md`
