# VAL-6 — Receipt Import Validation (Scoped Design)

**Date:** 2026-07-09  
**Status:** Approved  
**Parent:** `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md`  
**Depends on:** VAL-0 (`parseEurInputStrict`, `quantityInputSchema`, `nonNegativeCentsSchema`), VAL-1 (`restaurantNameSchema` / `validateBillMetadataField`), VAL-3 (`validateItemAddForm`, `validateItemAddArgs`, `itemNameSchema`)  
**Scope:** Receipt OCR review sheet — per-row item validation before import + server enforcement on `importScannedItems`

---

## Goal

Validate receipt import rows using the same item rules as VAL-3, with row-level inline errors in the review sheet and shared schema enforcement on the server. Users cannot import checked rows with invalid name, price, or quantity; Convex rejects bad payloads even if the client is bypassed. **Remove** silent `parseEurInput → 0`, silent quantity clamp (`Math.max(1, parseInt || 1)`), and the “skip empty name” filter on the import path.

---

## Non-goals

- Changing OCR extraction, scan scheduling, or rate limits (`startScan`, `runScan`)
- Totals mismatch warning in the footer (keep amber `detectTotalsMismatch` UX)
- Item notes on import (OCR does not extract notes; `note` stays undefined)
- Disabling the “Разпознай артикули” button on finalized bills (UI unchanged; server blocks import)
- `dismissScan` behavior
- Replacing `extractedItemValidator` in Convex schema definitions

---

## Surfaces

| Action                     | UI                                     | Mutation                                                  |
| -------------------------- | -------------------------------------- | --------------------------------------------------------- |
| Import checked OCR rows    | `receipt-scan-review-sheet.tsx`        | `receiptScan.importScannedItems`                          |
| Optional restaurant update | Same sheet (when OCR extracted a name) | Same mutation (`updateRestaurantName` + `restaurantName`) |
| Dismiss / cancel           | Same sheet                             | `receiptScan.dismissScan` (unchanged)                     |

> Roadmap refers generically to `receiptScan.apply`; the implemented mutation is **`importScannedItems`**.

---

## Current gaps (baseline)

**`receipt-scan-review-sheet.tsx`**

- `parsedRows` and `handleImport` use `parseEurInput` + `Math.max(1, parseInt || 1)` — same silent-failure pattern VAL-3 removed elsewhere.
- `handleImport` drops checked rows with empty trimmed names instead of surfacing a row error.
- Import button disabled only when `checkedCount === 0` or submitting — not when checked rows are invalid.
- No per-field inline errors on row inputs.
- Restaurant field has no client validation (server already validates via VAL-1 when `updateRestaurantName`).

**`convex/receiptScan.ts` (`importScannedItems`)**

- Inserts `item.name.trim()` with no `validateItemAddArgs`.
- No finalized-bill guard (`items.add` rejects `bill.status === 'final'`).
- Validates restaurant name only when patching bill metadata (already wired).
- Fallback path (`args.items` omitted) uses raw `scan.extractedItems` without schema validation.

---

## Validation rules

Reuse VAL-3 item primitives. Receipt rows map to `ItemAddFormInput`:

| Receipt row field | `ItemAddFormInput` key | Rules (same as VAL-3 add form)                                            |
| ----------------- | ---------------------- | ------------------------------------------------------------------------- |
| `name`            | `name`                 | `itemNameSchema` — trim; 1–120 chars                                      |
| `priceInput`      | `priceInput`           | `parseEurInputStrict` → `nonNegativeCentsSchema('Цената')` — zero allowed |
| `quantity`        | `quantityInput`        | `quantityInputSchema` — int ≥ 1, max 999                                  |
| Note              | —                      | Not collected on import                                                   |

### Row validation scope

| Row state | Validated?                                               |
| --------- | -------------------------------------------------------- |
| Checked   | Yes — all three fields                                   |
| Unchecked | No — user may leave junk rows unchecked; no errors shown |

### Restaurant (optional)

When `updateRestaurantName === true`:

| Field            | Rules                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| `restaurantName` | `validateBillMetadataField('restaurantName', value)` (VAL-1) — optional empty allowed; max 80 chars |

When checkbox off, restaurant value is not sent and not validated on client.

### Price semantics (receipt rows)

| Input              | Result                                          |
| ------------------ | ----------------------------------------------- |
| Empty / whitespace | Invalid — row error on price field              |
| Invalid            | `"abc"`, `"-"` → `Невалидна сума.`              |
| Zero               | `"0"`, `"0,00"` → `unitPriceCents: 0` (allowed) |
| Valid              | `"12,50"` → `1250`                              |

### Quantity semantics (receipt rows)

| Input                   | Result                                                        |
| ----------------------- | ------------------------------------------------------------- |
| Empty / `"0"` / invalid | Invalid — row error (`Количеството трябва да е поне 1.` etc.) |
| Valid                   | `"1"` … `"999"` → parsed int                                  |

### Error messages

| Field          | Source                                                     |
| -------------- | ---------------------------------------------------------- |
| Name           | `itemNameSchema` messages (same as VAL-3)                  |
| Price          | `parseEurInputStrict` / `nonNegativeCentsSchema`           |
| Quantity       | `quantityInputSchema`                                      |
| Restaurant     | `validateBillMetadataField` / `formatBillMetadataErrors`   |
| Finalized bill | `Сметката е завършена.`                                    |
| Server batch   | `Артикул {n}: {first field message}` when item index known |

### Finalized bill

Align with `items.add`:

- `importScannedItems` — reject when `bill.status === 'final'` **before** any item deletes (replace mode) or inserts.

---

## Shared schema API

**File:** `shared/receipt-import-schema.ts`  
**Tests:** `shared/receipt-import-schema.test.ts`  
**Shims:** `src/lib/receipt-import-schema.ts`, `convex/lib/receiptImportSchema.ts`

Thin batch layer over VAL-3 — no duplicate Zod field rules.

```ts
import type { ItemAddData, ItemAddFormInput, ItemField } from './item-schema'
import { validateItemAddForm, validateItemAddArgs } from './item-schema'
import type { ItemAddArgs } from './item-schema'

/** One editable row in the review sheet (no note). */
export type ReceiptImportRowInput = ItemAddFormInput

export type ReceiptImportRowWithSelection = ReceiptImportRowInput & {
  checked: boolean
}

export type ReceiptImportRowErrors = Partial<Record<ItemField, string>>

/** Validate a single row — delegates to validateItemAddForm. */
export function validateReceiptImportRow(
  input: ReceiptImportRowInput,
):
  | { ok: true; data: ItemAddData }
  | { ok: false; fieldErrors: ReceiptImportRowErrors }

/** Validate all checked rows; unchecked rows ignored. */
export function validateReceiptImportSelection(
  rows: ReceiptImportRowWithSelection[],
):
  | { ok: true; data: ItemAddData[]; checkedIndexes: number[] }
  | {
      ok: false
      rowErrors: Record<number, ReceiptImportRowErrors>
      checkedCount: number
    }

/** Server: validate normalized items before DB writes. */
export function validateReceiptImportItems(
  items: ItemAddArgs[],
):
  | { ok: true; data: ItemAddData[] }
  | { ok: false; message: string; index?: number }
```

### `validateReceiptImportSelection` behavior

1. Filter to `checked === true` rows; preserve original `index` for error mapping.
2. Run `validateReceiptImportRow` on each checked row.
3. If any fail → `{ ok: false, rowErrors: { [index]: fieldErrors } }`.
4. If all pass → `{ ok: true, data: [...], checkedIndexes: [...] }` in sheet row order.

### `validateReceiptImportItems` behavior

1. For each item at `index`, run `validateItemAddArgs`.
2. On first failure → `{ ok: false, message: 'Артикул {index + 1}: …', index }`.
3. On success → `{ ok: true, data: validated items }`.

---

## Server behavior

### `importScannedItems`

```ts
const bill = await requireBillOwner(ctx, scan.billId)
if (bill.status === 'final') {
  throw new ConvexError('Сметката е завършена.')
}

const itemsToImport =
  args.items ??
  (scan.extractedItems ?? []).filter((_, index) => selectedIndexSet.has(index))

const validated = validateReceiptImportItems(itemsToImport)
if (!validated.ok) {
  throw new ConvexError(validated.message)
}

// replace-mode deletes + inserts use validated.data only
for (const [index, item] of validated.data.entries()) {
  await ctx.db.insert('items', {
    billId: scan.billId,
    name: item.name,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    sortOrder: sortOrderOffset + index,
  })
}
```

**Ordering:** owner check → finalized guard → resolve `itemsToImport` → **validate all items** → replace deletes (if mode `replace`) → inserts → optional restaurant patch (existing VAL-1 path).

Restaurant patch block stays as today (`restaurantNameSchema().safeParse`).

---

## Client behavior

### Review sheet (`receipt-scan-review-sheet.tsx`)

**Imports:** `#/lib/receipt-import-schema.ts` and `#/lib/bill-metadata-schema.ts` (restaurant field only). Do **not** import `#/lib/validation/index.ts` (Vite resolve issue from VAL-3).

**Row errors (derived state):**

```ts
const selection = validateReceiptImportSelection(
  rows.map((row) => ({
    checked: row.checked,
    name: row.name,
    priceInput: row.priceInput,
    quantityInput: row.quantity,
  })),
)

const rowErrors = selection.ok === false ? selection.rowErrors : {}
const hasInvalidCheckedRows = selection.ok === false
const importableData = selection.ok ? selection.data : []
const importableIndexes = selection.ok ? selection.checkedIndexes : []
```

Recompute on every render (rows are local state; sheet is small). Optional: clear a row’s field error when that field’s input changes (same pattern as `ItemList`).

**Per-row UI:**

- Show first field error under name / price / qty inputs when `rowErrors[index]` present.
- Row container: `border-destructive` when checked and row has errors; keep amber styling for `confidence === 'low'` when no validation error (destructive takes precedence).
- Inputs: `aria-invalid` when field has error.

**Restaurant UI (when OCR block visible):**

```ts
const restaurantError = updateRestaurantName
  ? validateBillMetadataField('restaurantName', restaurantName)
  : { ok: true as const }
```

Show inline error under restaurant input when `!restaurantError.ok`.

**Footer totals:**

- Replace loose `parseEurInput` / qty clamp in `parsedRows`.
- Sum **checked rows that pass** `validateReceiptImportRow` only (invalid checked rows excluded from sum).
- Keep existing `detectTotalsMismatch` + amber warning unchanged.

**Import button:**

```ts
disabled={
  isSubmitting ||
  checkedCount === 0 ||
  hasInvalidCheckedRows ||
  (updateRestaurantName && !restaurantError.ok)
}
```

**`handleImport`:**

```ts
const selection = validateReceiptImportSelection(...)
if (!selection.ok) return // button should already be disabled

if (updateRestaurantName) {
  const r = validateBillMetadataField('restaurantName', restaurantName)
  if (!r.ok) return
}

await importScannedItems({
  scanId,
  mode: importMode,
  selectedIndexes: selection.checkedIndexes,
  updateRestaurantName,
  restaurantName: updateRestaurantName ? restaurantName : undefined,
  items: selection.data.map((d) => ({
    name: d.name,
    unitPriceCents: d.unitPriceCents,
    quantity: d.quantity,
  })),
})
```

Remove the `row.name.trim().length > 0` filter — empty names surface as row errors instead.

Toast on zero checked rows unchanged (`Изберете поне един артикул за импортиране`).

---

## Tests

**File:** `shared/receipt-import-schema.test.ts`

| Case                                    | Expect                                                     |
| --------------------------------------- | ---------------------------------------------------------- |
| Single valid row                        | `validateReceiptImportRow` → ok                            |
| Empty name                              | field error on `name`                                      |
| Whitespace-only name                    | field error on `name`                                      |
| Invalid price `"abc"`                   | field error on `price`                                     |
| Empty price                             | field error on `price`                                     |
| Zero price `"0,00"`                     | ok, `unitPriceCents: 0`                                    |
| Qty `0` / empty / `"abc"`               | field error on `quantity`                                  |
| Unchecked invalid row                   | `validateReceiptImportSelection` → ok (row ignored)        |
| One checked invalid + one checked valid | `rowErrors` on invalid index only                          |
| All checked valid                       | `data` length matches checked count                        |
| Server batch — second item bad name     | `validateReceiptImportItems` message contains `Артикул 2:` |
| Server batch — valid items              | ok, trimmed names                                          |

Reuse fixtures style from `shared/item-schema.test.ts` where possible.

---

## Files to touch

| File                                                 | Change                                         |
| ---------------------------------------------------- | ---------------------------------------------- |
| `shared/receipt-import-schema.ts`                    | New batch validators                           |
| `shared/receipt-import-schema.test.ts`               | OCR junk + batch tests                         |
| `src/lib/receipt-import-schema.ts`                   | Re-export shim                                 |
| `convex/lib/receiptImportSchema.ts`                  | Re-export shim                                 |
| `convex/receiptScan.ts`                              | Finalized guard + `validateReceiptImportItems` |
| `src/components/bills/receipt-scan-review-sheet.tsx` | Row errors, strict footer sum, button guard    |

No changes to `shared/item-schema.ts` unless a shared helper is genuinely missing (prefer composition in receipt-import module).

---

## Exit criteria

- [x] Review sheet blocks import when any **checked** row is invalid (name / price / qty)
- [x] Per-row inline errors visible before import
- [x] `importScannedItems` validates every item via shared schema (client `items` path and `extractedItems` fallback)
- [x] Finalized bill rejected on import
- [x] `shared/receipt-import-schema.test.ts` covers typical OCR junk rows
- [x] `pnpm run preflight` passes

---

## Suggested next step

After approval: write `docs/superpowers/plans/2026-07-09-val-6-receipt-import.md`, then implement on **`1`**.
