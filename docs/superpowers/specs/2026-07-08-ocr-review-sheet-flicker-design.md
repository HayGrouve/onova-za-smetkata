# OCR Review Sheet Scroll Flicker — Design

**Status:** Approved  
**Date:** 2026-07-08

## Problem

On mobile, after uploading a receipt and completing OCR, the review sheet opens correctly but **flickers continuously while scrolling the item list**. Flicker is worst during scroll, not on idle.

## Root cause

The bill editor keeps `StickyTotalsBar` rendered (fixed, `backdrop-blur`) while the OCR review sheet is open. The sheet’s outer `SheetContent` uses a transparent wrapper with `mb-16`, leaving the blurred footer visible underneath the scrolling list. iOS Safari (and some Android browsers) repaint the blurred fixed layer on every scroll frame → visible flicker.

Secondary: on first paint, review rows are seeded in `useEffect`, so `rows.length === 0` briefly shows “Няма разпознати артикули” even when items exist.

## Solution

1. **Hide `StickyTotalsBar`** while `reviewSheetOpen` is true.
2. **Opaque review sheet** — remove transparent/`mb-16` outer wrapper; single solid `bg-background` surface with safe-area padding.
3. **Guard empty-state copy** — only show “Няма разпознати артикули” when the scan truly has zero extracted items.

## Out of scope

- General page navigation / auth loading flicker
- Receipt image upload layout shift
- Sheet animation timing changes

## Success criteria

- Scroll the full OCR item list on a phone with no visible flicker
- Sticky totals bar returns when the sheet closes
- Import / cancel unchanged

## Files

| File | Change |
|------|--------|
| `src/routes/bills/$billId/index.tsx` | Conditionally render `StickyTotalsBar` |
| `src/components/bills/receipt-scan-review-sheet.tsx` | Opaque layout + empty-state guard |
