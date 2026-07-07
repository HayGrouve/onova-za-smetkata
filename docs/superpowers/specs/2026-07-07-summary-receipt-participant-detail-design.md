# Summary Receipt Preview & Participant Detail — Design Spec

**Date:** 2026-07-07  
**Project:** onova-za-smetkata  
**Status:** Approved  
**Builds on:** `docs/superpowers/specs/2026-07-07-personal-bill-splitter-design.md`

## Summary

Enhance the bill summary page with a tappable receipt image (expand to full-screen modal) and a per-participant breakdown bottom sheet showing consumed items, tip share, totals, and payment actions.

## Decisions

| Decision | Choice |
|----------|--------|
| Participant detail UI | Bottom sheet (same pattern as editor sticky totals) |
| Receipt on summary | Always visible thumbnail when uploaded |
| Receipt expand | Tap thumbnail → full-screen Dialog/lightbox |
| Payment actions | On summary row **and** repeated at bottom of participant sheet |
| Breakdown calculation | Pure client-side function in `bill-calculations.ts` |
| Entry point | Summary page only (not sticky bar on editor) |

## Architecture

```
[Bill Summary]
  │ api.bills.get (existing)
  │ api.files.getUrl (existing, when receiptStorageId set)
  │
  ├─ ReceiptPreviewCard
  │    thumbnail → Dialog (full image)
  │
  └─ PaymentRow (per participant)
       tap name/row → ParticipantDetailSheet
         calculateParticipantBreakdown()
         line items + tip + totals
         PaymentActions (shared with row)
```

**No Convex schema changes.** Breakdown is derived from existing bill data using the same split rules as `calculateBillTotals`.

## UI — Receipt preview

### Placement

Card **„Касова бележка“** on summary page, below the total card and above validation / finalize / payments sections.

### Behavior

- Hidden when `bill.receiptStorageId` is absent
- Shows bordered thumbnail (`max-h-64`, `object-contain`) matching editor styling
- Entire image is tappable
- Tap opens **Dialog** with full-width image, vertically scrollable for tall receipts
- Close via X button, backdrop tap, or Escape
- Loading state while `getUrl` resolves

## UI — Participant detail sheet

### Trigger

- Tap participant **name** or the row header area (name + status badge)
- Payment buttons on the summary row do **not** open the sheet (`stopPropagation`)

### Content (top to bottom)

1. **Header:** participant label + payment status badge
2. **Line items:** one row per item the participant owes money on
   - Label: item name
   - Unit split: suffix „· N от M“ when `units` assignment used
   - Equal split: suffix „· споделено с N“ when multiple assignees (N = count − 1)
   - Amount: participant's share in EUR
3. **Tip line** (only if `tipCents > 0`): „Бакшиш (1/K)“ where K = participant count, with their share
4. **Separator**
5. **Totals block:** Дължи / Платено / Остатък (must match `calculateBillTotals`)
6. **Payment actions:** same controls as `PaymentRow` (Платено + partial payment)

### Empty state

If participant owes only tip (no item assignments), show tip line only. If they owe nothing at all, show „Няма разпределени артикули.“ and still show totals/payment if applicable.

## Calculation — `calculateParticipantBreakdown`

New types in `src/lib/bill-calculations.ts`:

```typescript
export interface ItemBreakdownInput extends ItemInput {
  name: string
}

export interface BillBreakdownInput {
  participants: ParticipantInput[]
  items: ItemBreakdownInput[]
  assignments: AssignmentInput[]
  tipCents?: number
}

export interface ParticipantBreakdownLine {
  kind: 'item' | 'tip'
  label: string
  amountCents: number
  sharedWithCount?: number
  units?: number
  totalUnits?: number
}

export interface ParticipantBreakdown {
  lines: ParticipantBreakdownLine[]
  itemsSubtotalCents: number
  tipCents: number
  owedCents: number
}
```

### Rules (must mirror `calculateBillTotals`)

| Case | Breakdown line |
|------|----------------|
| Unit assignment | One line per assigned item; amount = `units × unitPriceCents`; show units vs item quantity |
| Equal multi-assign | One line; amount from `splitLineTotal`; show shared count |
| Single assignee | One line; full line total |
| Tip | One line per participant when tip > 0; amount from equal split among all participants |
| Zero share | Omit line (participant not on item) |

### Invariant

For every participant: `sum(line.amountCents) === owedCents` from `calculateBillTotals` for the same input (excluding payments).

## Components

| Component | File | Responsibility |
|-----------|------|------------------|
| `ReceiptPreviewCard` | `src/components/bills/receipt-preview-card.tsx` | Thumbnail + expand Dialog |
| `ParticipantDetailSheet` | `src/components/bills/participant-detail-sheet.tsx` | Breakdown sheet + payment actions |
| `PaymentActions` | `src/components/bills/payment-actions.tsx` | Shared mark-paid / partial UI (extracted from `PaymentRow`) |
| `PaymentRow` | modify | Tap-to-open sheet; use `PaymentActions` |
| `BillSummary` | `src/routes/bills/$billId/summary.tsx` | Wire receipt card + sheet state |

## Out of scope

- Receipt in participant sheet
- Editing assignments from summary
- Breakdown from editor sticky totals bar
- PDF / share export
- Payment history list in sheet

## Testing

Unit tests in `src/lib/bill-calculations.test.ts`:

1. Single assignee — full item amount on one line
2. Equal split — correct share + shared count metadata
3. Unit split — correct units label and amount
4. Tip — separate tip line; sum matches totals
5. Invariant test — breakdown `owedCents` equals `calculateBillTotals().byParticipant[id].owedCents`

## Error handling

- Missing receipt URL: hide card (no error toast)
- Participant with no lines but non-zero owed: should not occur if invariant holds; show totals only
- Sheet uses live Convex data; payments update reactively after mutation
