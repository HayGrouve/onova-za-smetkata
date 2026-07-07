# App Icons & Payment Row Highlight — Design Spec

**Date:** 2026-07-07  
**Project:** onova-za-smetkata  
**Status:** Approved  

## Summary

Add Lucide icons across the app for section headers and primary actions, and highlight payment rows on the summary screen by status: unpaid (red left border), partial (amber left border), paid (no highlight).

## Decisions

| Decision | Choice |
|----------|--------|
| Icon library | **Lucide React** (already installed) |
| Icon organization | Light centralization in `src/lib/app-icons.ts` (size constants + re-exports) |
| Card section titles | Icon before title text, `gap-2`, muted icon color |
| Payment highlight scope | Summary `PaymentRow` only (not sticky bar breakdown or detail sheet) |
| Unpaid highlight | `border-l-4 border-red-500` |
| Partial highlight | `border-l-4 border-amber-500` (matches unassigned items in editor) |
| Paid highlight | None |

## Icon conventions

- `size-4` on buttons and inline UI; `size-5` on header icon buttons (unchanged)
- Icon before label with `gap-2` on buttons
- Decorative icons: `aria-hidden`
- Icon-only buttons: keep existing `aria-label`
- Do not add icons to every form field label — sections and actions only

## Icon map

| Screen / component | Element | Icon |
|--------------------|---------|------|
| Home | Нова сметка | `Plus` |
| Home | Search field | `Search` |
| Home | Payment settings (full width) | `Wallet` |
| Bill card | Delete menu item | `Trash2` |
| Editor | Данни за сметката | `Receipt` |
| Editor | Receipt scan | `ScanLine` |
| Editor | Участници | `Users` |
| Editor | Добави (participant) | `UserPlus` |
| Editor | Артикули | `ShoppingBag` |
| Editor | Добави артикул | `Plus` |
| Editor | Unassigned badge | `AlertTriangle` |
| Summary | Обща сума | `CircleDollarSign` |
| Summary | Сподели | `Share2` |
| Summary | Завърши сметка | `CheckCircle` |
| Summary | Плащания | `Banknote` |
| Summary | Validation errors | `AlertCircle` |
| Summary | Редактирай | `Pencil` |
| Summary | Изтрий | `Trash2` |
| Payment row | Revolut | `Send` |
| Payment row | Платено | `Check` |
| Payment row | Плати (partial) | `Coins` |
| Payment row | Copy remaining hint | `Copy` (inline next to остатък label) |
| Settings sheet | Title | `Wallet` |
| Settings sheet | Copy IBAN | `Copy` |
| Settings sheet | Запази | `Save` |
| Sticky bar | Breakdown sheet title | `PieChart` |
| Error page | Опитай отново | `RefreshCw` |

Existing icons (back chevron, cog, trash on items, assignment +/-, X) remain unchanged.

## Payment row highlighting

In `PaymentRow`, apply `cn()` classes matching `item-list.tsx` pattern:

```tsx
className={cn(
  'flex flex-col gap-2 rounded-lg border p-3',
  totals.status === 'unpaid' && 'border-l-4 border-red-500',
  totals.status === 'partial' && 'border-l-4 border-amber-500',
)}
```

Status badges (`неплатено` / `частично` / `платено`) unchanged.

## Components / files

| File | Change |
|------|--------|
| `src/lib/app-icons.ts` | New — icon size constants |
| `src/components/bills/payment-row.tsx` | Status border highlight + copy icon |
| `src/components/bills/payment-actions.tsx` | Icons on Платено / Плати |
| `src/components/bills/participant-pay-actions.tsx` | Icon on Revolut |
| `src/components/bills/payment-settings-sheet.tsx` | Title + button icons |
| `src/components/bills/payment-settings-open-button.tsx` | Wallet on full button |
| `src/components/bills/item-list.tsx` | Icons on badge + add button |
| `src/components/bills/participant-list.tsx` | UserPlus on add |
| `src/components/bills/bill-card.tsx` | Trash on delete menu item |
| `src/components/bills/sticky-totals-bar.tsx` | PieChart on breakdown title |
| `src/routes/index.tsx` | Wallet on settings button |
| `src/routes/bills/$billId/index.tsx` | Card title icons + ScanLine |
| `src/routes/bills/$billId/summary.tsx` | Card title icons + action icons |
| `src/routes/__root.tsx` | RefreshCw on retry |
| `src/components/bills/payment-row.test.tsx` | New — highlight class tests |

## Testing

- Unit test `PaymentRow` renders correct border classes per `PaymentStatus`
- Run `npm test` and manual visual check on home, editor, summary

## Out of scope

- Sticky totals breakdown row highlighting
- Participant detail sheet row highlighting
- New icon library dependency
- PWA / manifest icon changes
