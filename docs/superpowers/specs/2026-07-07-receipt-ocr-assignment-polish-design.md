# Receipt OCR & Assignment Polish — Design Spec

**Date:** 2026-07-07  
**Project:** onova-za-smetkata  
**Status:** Approved  
**Builds on:** `docs/superpowers/specs/2026-07-07-personal-bill-splitter-design.md`

## Summary

Add manual receipt scanning via Gemini 2.0 Flash (Convex Action), a human review step before importing line items, and bulk assignment helpers to speed up splitting items among participants. Keeps existing chip-based per-item assignment.

## Decisions

| Decision | Choice |
|----------|--------|
| Scan trigger | Manual **„Разпознай артикули“** button (only when receipt photo exists) |
| AI provider | Google Gemini 2.0 Flash via Convex Action |
| API key storage | `GEMINI_API_KEY` in Convex environment variables |
| Assignment UX | Keep participant chips; add bulk split helpers |
| Re-import when items exist | Dialog: **Добави** / **Замени** / **Отказ** |
| Import flow | Always review in sheet before writing to database |

## Architecture

```
[Bill Editor]
  │ receipt photo uploaded (existing HEIC→JPEG flow)
  │ user taps „Разпознай артикули“
  │ (optional) Add/Replace dialog if items already exist
  ▼
[Convex Action: scanReceipt]
  │ load image URL from ctx.storage
  │ call Gemini 2.0 Flash with structured JSON schema
  │ store result in receiptScans table
  ▼
[Review Sheet — bottom drawer]
  │ edit rows, toggle checkboxes, fix prices
  │ optional: update restaurant name
  ▼
[Convex Mutation: importScannedItems]
  │ insert selected items (add or replace mode)
  ▼
[Bill Editor]
  │ bulk assignment toolbar + existing chips
```

**Why Action, not Mutation:** External API call to Gemini; side effects; API key must stay server-side.

**Why review sheet:** Receipt OCR is unreliable on thermal/Cyrillic prints. User must confirm before import.

## Data Model

### New table: `receiptScans`

| Field | Type | Notes |
|-------|------|-------|
| billId | Id<"bills"> | |
| storageId | Id<"_storage"> | Receipt image scanned |
| status | "pending" \| "processing" \| "done" \| "failed" | |
| extractedRestaurantName | string? | |
| extractedItems | array of objects | See schema below |
| receiptTotalCents | number? | For validation hint |
| itemsTotalCents | number? | Sum of extracted items |
| totalsMismatch | boolean? | true if sums differ |
| errorMessage | string? | On failure |
| createdAt | number | |

**extractedItems element:**

```typescript
{
  name: string
  unitPriceCents: number
  quantity: number
  confidence: "high" | "low"
}
```

**Index:** `by_billId` on `receiptScans`

### No changes to existing tables

Items, assignments, participants, bills schema unchanged. Import uses existing `items.add` or bulk insert mutation.

## Convex Functions

### `convex/receiptScan.ts`

| Function | Type | Purpose |
|----------|------|---------|
| `startScan` | mutation | Creates `receiptScans` row (status: pending), schedules action |
| `scanReceipt` | internal action | Calls Gemini, updates scan row |
| `getLatestScan` | query | Latest scan for bill (for review UI) |
| `importScannedItems` | mutation | Inserts checked items; replace mode deletes existing items first |
| `dismissScan` | mutation | Marks scan dismissed / clears pending review |

### Gemini integration

- **Model:** `gemini-2.0-flash` (or current stable flash vision model)
- **Input:** Receipt image URL (from Convex storage) as base64 or URL fetch in action
- **Output:** Strict JSON schema enforced via Gemini `responseSchema`
- **Runtime:** `"use node"` if needed for SDK; otherwise `fetch` to Gemini REST API from Convex action

**Prompt requirements:**
- Receipt may be Bulgarian (Cyrillic) or English; amounts in EUR
- Return purchasable line items only
- Exclude summary lines: ОБЩО, TOTAL, SUBTOTAL, ДДС, VAT, TAX, Бакшиш, TIP, payment/card lines
- Default quantity to 1 when not shown
- Prices as decimal EUR; action converts to integer cents
- Set `confidence: "low"` for ambiguous lines

**Post-processing in action:**
- Drop items with `unitPriceCents <= 0`
- Compute `itemsTotalCents` and compare to `receiptTotalCents` if present
- Set `totalsMismatch` when difference > 1 cent

### `importScannedItems` mutation

**Args:**
- `scanId: Id<"receiptScans">`
- `mode: "add" | "replace"`
- `selectedIndexes: number[]` — indices into extractedItems
- `updateRestaurantName: boolean`
- `restaurantName?: string` — edited value from review UI

**Replace mode:**
1. Delete all existing items (cascade assignments via existing remove logic)
2. Insert selected scanned items

**Add mode:**
1. Insert selected scanned items only

Always update bill `restaurantName` if `updateRestaurantName` is true.

## UI Changes

### Bill Editor — receipt section

Add button below photo upload:

- **„Разпознай артикули“** — disabled if no receipt or scan in progress
- Loading: **„Разпознаване…“** with spinner

**Pre-scan dialog** (when `items.length > 0`):

| Button | Action |
|--------|--------|
| Добави | Scan → review → import in add mode |
| Замени | Scan → review → import in replace mode (extra confirm if items have assignments) |
| Отказ | Close |

Store chosen mode in component state until import completes.

### Review Sheet (`ReceiptScanReviewSheet`)

Opens automatically when scan status becomes `done`.

**Header:** „Преглед на разпознатите артикули“

**Restaurant (if detected):**
- Input pre-filled with `extractedRestaurantName`
- Checkbox: „Обнови името на ресторанта“ (default on if name was empty)

**Item list:**
- Each row: checkbox (default on), name input, price input (EUR), quantity input
- Low-confidence rows: amber background + „?“ badge
- Select all / deselect all toggle

**Totals footer:**
- „Сумата на артикулите: {formatEur(itemsTotalCents)}“
- If receipt total detected: „Общо на бележка: {formatEur(receiptTotalCents)}“
- If mismatch: warning „Сумите не съвпадат — проверете артикулите“

**Actions:**
- **„Импортирай избраните ({n})“** — calls import mutation
- **„Отказ“** — dismiss sheet

On success: toast „{n} артикула добавени“, close sheet.

### Bulk assignment toolbar

New component above item list in bill editor: `AssignmentToolbar`

| Control | Label | Behavior |
|---------|-------|----------|
| Button | Разпредели всички по равно | For every item, assign all participants (toggle on all chips) |
| Button | Разпредели оставащите по равно | Only items with zero assignments → assign all participants |
| Badge | {n} неразпределени | Visible when n > 0; tap scrolls to first unassigned item |

**Unassigned visual:** Items with no assignments show amber/red left border until assigned.

Implementation: batch calls to existing `assignments.toggle` or new `assignments.assignAll` mutation for efficiency.

### Minor polish (same release)

- Change item price placeholder from „Цена (лв)“ to **„Цена (€)“**
- Error toasts in Bulgarian for scan failures

## Error Handling

| Scenario | UX |
|----------|-----|
| No receipt photo | Button hidden/disabled |
| Missing GEMINI_API_KEY | Action fails; toast: „AI не е конфигуриран“ |
| Gemini timeout/error | Scan status `failed`; toast with retry hint |
| Empty extraction | Review sheet shows „Няма разпознати артикули“ |
| User cancels review | No DB changes |
| Replace with assignments | Confirm dialog: „Ще изтриете съществуващите артикули и разпределенията“ |

## Business Rules

- Scan does not auto-run on photo upload
- Scan does not modify items until user confirms import
- Replace mode deletes all items and their assignments before import
- Imported items have no assignments (user assigns via chips or bulk helpers)
- OCR tax/tip lines should be excluded by prompt; user can add manually as items
- Re-scan allowed; Add/Replace dialog shown again if items exist

## Testing

**Unit tests:**
- Post-process filter (exclude zero/negative prices)
- Totals mismatch detection
- Import index selection logic (client helper)

**Manual test plan:**
1. Upload receipt → scan → review → import
2. Scan with existing items → Add vs Replace dialog
3. Bulk „Разпредели всички по равно“ → verify sticky totals
4. „Разпредели оставащите“ with partial assignments
5. Low-confidence row editing before import
6. Failed scan (invalid API key) → error toast

## Out of Scope

- Auto-scan on upload
- Claim mode (select person then tap items)
- OCR-suggested person assignments
- Scan history UI (table stores data; no history screen)
- PDF receipts
- Multi-currency OCR
- Offline scan queue

## Acceptance Criteria

1. User can tap **„Разпознай артикули“** after uploading a receipt photo
2. Gemini extracts line items; user reviews in sheet before import
3. User can add or replace existing items (with dialog when items exist)
4. User can edit names/prices/quantities and uncheck rows before import
5. Restaurant name can be updated from scan result
6. Bulk **„Разпредели всички по равно“** and **„Разпредели оставащите по равно“** work
7. Unassigned items are visually highlighted with count badge
8. Totals mismatch shows warning when receipt total ≠ items sum
9. Scan failures show Bulgarian error message; user can retry

## Environment Setup

Add to Convex dashboard → Settings → Environment Variables:

```
GEMINI_API_KEY=<your-key>
```

Document in `.env.example` (comment only — key lives in Convex, not client).

## Build Order

1. `receiptScans` schema + queries
2. Gemini action + post-processing
3. Import mutation (add/replace)
4. Review sheet UI
5. Scan button + pre-scan dialog
6. Bulk assignment toolbar + `assignments.assignAll` mutation
7. Visual polish (unassigned highlight, € placeholder)
8. Tests + manual verification
