# How receipt import persists items today

Research for [#159](https://github.com/HayGrouve/onova-za-smetkata/issues/159). Feeds the line coalescing spec map ([#158](https://github.com/HayGrouve/onova-za-smetkata/issues/158)).

## Question

What is the exact path from extracted receipt lines to Item documents today (Gemini extract, review selection, `add` vs `replace`, validation, insert), and does any step already group or drop duplicate printed lines?

## Summary

**No.** Nothing in the persist path groups same-product lines or drops them because they look like duplicates. Line coalescing is not implemented.

Gemini is asked to set `quantity` for identical Units **on one printed line** (for example `2 x Капучино` becomes one row with `quantity: 2`). That is per-line Unit count, not folding two printed rows into one Item. After extract, the pipeline keeps a 1:1 mapping: one Gemini row → one `extractedItems` slot → one review row → one `items` insert, unless the Host unchecks the row or a per-row validator rejects it.

The only automatic drop is unusable extract rows (empty name or `unitPriceCents <= 0`) in `convex/receiptScanAction.ts`. Import `add` appends. Import `replace` deletes every existing Item and its `itemAssignments`, then inserts the selected batch. Neither mode looks at name or price identity.

---

## Path (Host, draft bill)

1. Host uploads a receipt image. `useReceiptScan` writes `bills.receiptStorageId` via `bills.update` (`src/hooks/use-receipt-scan.ts`).
2. Host starts OCR. If the draft already has Items, a dialog chooses `add` or `replace` **before** the scan (`use-receipt-scan.ts`, wired in `src/routes/bills/$billId/index.tsx`). `replace` with existing assignments gets a second confirm. That choice is client state `importMode`. It is not stored on the scan document.
3. `receiptScan.startScan` requires bill owner + draft, OCR quota, rate limit, and a receipt image. It inserts `receiptScans` (`pending`) and schedules `receiptScanAction.runScan` (`convex/receiptScan.ts`).
4. `runScan` loads the image, calls `scanReceiptImage`, filters empty/zero-price rows, computes totals mismatch, and `markDone`s the scan (`convex/receiptScanAction.ts`).
5. When `getLatestScan` is `done`, the hook opens `ReceiptScanReviewSheet` with that `importMode`.
6. The sheet maps each extracted row into an editable, checked review row. Confirm runs client validation, then `importScannedItems`, then `dismissScan`.

There are no E2E tests for this path. Coverage is unit tests on validation and extract-row filtering (`shared/receipt-import-schema.test.ts`, `src/lib/receipt-scan-utils.test.ts`). There is no Convex test of `importScannedItems`.

---

## Gemini extract

`scanReceiptImage` in `convex/lib/geminiReceipt.ts` posts the image plus a user `text` prompt to Gemini with `RESPONSE_SCHEMA`: `restaurantName`, `receiptTotalEur`, and `items[]` of `{ name, unitPriceEur, quantity, confidence }`.

Post-parse mapping, per item, with no look at other items:

- `name`: `trim()`
- `unitPriceCents`: `Math.round(unitPriceEur * 100)`
- `quantity`: `Math.max(1, Math.round(quantity))`
- `confidence`: `'low'` or `'high'`

The prompt (same text as `docs/specs/ocr-english-item-names.md`) tells the model to return purchasable food/drink only, exclude totals/tax/tips/payment lines, write English names, and treat `quantity` as “how many identical units were ordered” without putting the order count in `name`. Golden pair: printed `2 x Капучино` → `name` Cappuccino, `quantity: 2`. The spec also says to translate each line independently and to emit `Unknown item` on every unreadable priced line. It does not ask Gemini to combine repeated printed products.

If the model happens to emit one row for two identical printed lines, that is model behavior, not app logic. The TypeScript after the JSON parse does not group.

---

## Persist of extract (not yet Items)

`convex/receiptScanAction.ts` then:

```ts
const filtered = result.items.filter(
  (i) => i.unitPriceCents > 0 && i.name.trim().length > 0,
)
```

Dropped rows never reach `receiptScans.extractedItems`. Same predicate exists as `filterExtractedItems` in `src/lib/receipt-scan-utils.ts` and is tested for zero/negative prices (`src/lib/receipt-scan-utils.test.ts`). The action inlines the filter; the client helper is unused by the import UI.

`itemsTotalCents` is `sum(unitPriceCents * quantity)` on the filtered list. `totalsMismatch` is true when a receipt total exists and differs by more than 1 cent. `markDone` stores `extractedRestaurantName`, `extractedItems`, those totals, and `totalsMismatch`. Schema: `extractedItemValidator` is `{ name, unitPriceCents, quantity, confidence }` (`convex/schema.ts`). The `items` table has no `confidence` field.

This filter is not line coalescing. Two “Shopska salad” rows at the same price both survive.

---

## Review selection

`ReceiptScanReviewSheet` (`src/components/bills/receipt-scan-review-sheet.tsx`) initializes one row per `extractedItems` entry, all `checked: true`. The Host can edit name, EUR price, and quantity, uncheck rows, or toggle all. Low-confidence rows get a `?` badge. Empty extract shows “Няма разпознати артикули.”

Footer totals use only checked, valid rows (`validateReceiptImportRow` + `sumItemsCents`). Mismatch copy is a warning. It does not block import.

Confirm requires at least one checked row, then `validateReceiptImportSelection`. It calls:

```ts
importScannedItems({
  scanId,
  mode: importMode,
  selectedIndexes: importSelection.checkedIndexes,
  updateRestaurantName,
  restaurantName: updateRestaurantName ? restaurantName : undefined,
  items: importSelection.data.map((item) => ({
    name: item.name,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
  })),
})
```

The sheet always sends the edited `items` array. `selectedIndexes` is also sent, but unused when `items` is present (see import mutation). Duplicate names in the list stay as separate rows.

---

## `add` vs `replace`

Chosen in `useReceiptScan` before `startScan`, passed into the sheet as `importMode`.

| Host situation                               | What happens                                 |
| -------------------------------------------- | -------------------------------------------- |
| No existing Items                            | `beginScan('add')`                           |
| Existing Items                               | Dialog: Добави (`add`) or Замени (`replace`) |
| `replace` and the bill has `itemAssignments` | Extra confirm, then `beginScan('replace')`   |

Server (`importScannedItems` in `convex/receiptScan.ts`):

- Load existing Items by `billId`.
- `sortOrderOffset = existing.length`.
- If `mode === 'replace'`: delete every Item’s assignments, delete every Item, set `sortOrderOffset = 0`.
- Insert each validated import row at `sortOrderOffset + index`.

`add` does not look for an existing Item with the same name and `unitPriceCents`. It always inserts new documents, same as a manual `items.add` (`convex/items.ts`), which also uses `sortOrder: existing.length`. `replace` is wipe-then-insert of the selected batch, not “replace matching lines.”

Draft-only: `requireBillOwner` + `assertBillDraft`.

---

## Validation

Shared helpers in `shared/receipt-import-schema.ts` wrap `shared/item-schema.ts`. Re-exported to the client (`src/lib/receipt-import-schema.ts`) and Convex (`convex/lib/receiptImportSchema.ts`).

| Function                         | Used by                            | What it checks                                                                                                                            |
| -------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `validateReceiptImportRow`       | Review sheet, per row              | Same as `validateItemAddForm`: trimmed name 1–120 chars (`ITEM_NAME_MAX`), strict EUR parse, integer quantity 1–999 (`QUANTITY_MAX`)      |
| `validateReceiptImportSelection` | Review sheet, on render and submit | Validates **checked** rows only. Unchecked invalid rows are ignored. Returns `data` + `checkedIndexes`, or `rowErrors` keyed by row index |
| `validateReceiptImportItems`     | `importScannedItems`               | `validateItemAddArgs` on each normalized `{ name, unitPriceCents, quantity }`. First failure: `Артикул N: …`                              |

Tests (`shared/receipt-import-schema.test.ts`) cover empty/whitespace name, bad price, quantity `''` / `0` / `'abc'`, zero price **allowed** on the client form path, unchecked invalid rows ignored, and indexed server-batch errors. None of the tests mention two rows with the same name.

Server price rule is `nonNegativeCentsSchema` (integer cents ≥ 0). The extract filter already dropped `<= 0` prices, but the Host can type `0,00` in review and import it. Import does not send or persist `note` or `confidence`.

Restaurant name, if the Host keeps “Обнови името на ресторанта”, is validated with `restaurantNameSchema` on the server and `validateBillMetadataField('restaurantName', …)` on the client. Independent of item rows.

---

## Insert

For each entry in `validated.data`, `importScannedItems` inserts one `items` document:

```
billId, name, unitPriceCents, quantity, sortOrder
```

No assignment rows are created. New Units start unassigned, same as a manual add. `touchBill` runs after the loop.

Fallback if `items` is omitted: `extractedItems` filtered by `selectedIndexes`. The review sheet does not use that path.

Then the sheet `dismissScan`s (deletes the `receiptScans` document). Closing without import also dismisses.

---

## Does anything group or drop duplicate printed lines?

| Step                                                 | Groups same product?                           | Drops a row because it duplicates another?                   |
| ---------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| Gemini prompt + parse (`geminiReceipt.ts`, OCR spec) | No. Quantity is Units on **one** printed line. | Drops non-food lines only if the model follows the prompt.   |
| `runScan` filter                                     | No                                             | Drops empty name or `unitPriceCents <= 0` only.              |
| Review sheet                                         | No. One checkbox row per extract.              | Only if the Host unchecks.                                   |
| `validateReceiptImport*`                             | No uniqueness rule                             | Per-row field errors only.                                   |
| `importScannedItems` `add` / `replace`               | No                                             | `replace` deletes **all** existing Items, not matching ones. |

Two extracted lines with the same English name and `unitPriceCents` become two Item documents with two Unit stacks. That is the gap #158 wants a spec for. The persist hook the map already named is this mutation, over the **selected** (and here, edited) rows, not a second Gemini pass.
