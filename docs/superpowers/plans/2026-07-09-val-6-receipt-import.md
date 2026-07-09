# VAL-6 — Receipt Import Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate receipt OCR import rows (name, price, qty) in the review sheet and on `importScannedItems` — per-row inline errors, shared schema enforcement, no silent parse fallbacks.

**Architecture:** Thin `shared/receipt-import-schema.ts` batch layer over VAL-3 `validateItemAddForm` / `validateItemAddArgs`; review sheet derives row errors from `validateReceiptImportSelection`; Convex validates before any replace/delete writes.

**Tech Stack:** Zod 4, Convex, React, Vitest

**Spec:** `docs/superpowers/specs/2026-07-09-val-6-receipt-import-design.md`

**Status:** ✅ Complete (2026-07-09)

---

## Task 1: Receipt import schema (TDD)

**Files:**
- Create: `shared/receipt-import-schema.ts`
- Create: `shared/receipt-import-schema.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// shared/receipt-import-schema.test.ts
import { describe, expect, it } from 'vitest'
import {
  validateReceiptImportItems,
  validateReceiptImportRow,
  validateReceiptImportSelection,
} from './receipt-import-schema'

const validRow = {
  name: 'Салата',
  priceInput: '12,50',
  quantityInput: '2',
}

describe('validateReceiptImportRow', () => {
  it('accepts valid row', () => {
    const result = validateReceiptImportRow(validRow)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual({
        name: 'Салата',
        unitPriceCents: 1250,
        quantity: 2,
      })
    }
  })

  it('rejects empty name', () => {
    const result = validateReceiptImportRow({ ...validRow, name: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.name).toBeTruthy()
  })

  it('rejects whitespace-only name', () => {
    const result = validateReceiptImportRow({ ...validRow, name: '   ' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.name).toBeTruthy()
  })

  it('rejects invalid price', () => {
    const result = validateReceiptImportRow({ ...validRow, priceInput: 'abc' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.price).toBeTruthy()
  })

  it('rejects empty price', () => {
    const result = validateReceiptImportRow({ ...validRow, priceInput: '' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.fieldErrors.price).toBeTruthy()
  })

  it('allows zero price', () => {
    const result = validateReceiptImportRow({ ...validRow, priceInput: '0,00' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.unitPriceCents).toBe(0)
  })

  it('rejects invalid quantity', () => {
    for (const quantityInput of ['', '0', 'abc']) {
      const result = validateReceiptImportRow({ ...validRow, quantityInput })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.fieldErrors.quantity).toBeTruthy()
    }
  })
})

describe('validateReceiptImportSelection', () => {
  it('ignores unchecked invalid rows', () => {
    const result = validateReceiptImportSelection([
      { checked: false, ...validRow, name: '' },
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual([])
      expect(result.checkedIndexes).toEqual([])
    }
  })

  it('returns rowErrors for checked invalid row', () => {
    const result = validateReceiptImportSelection([
      { checked: true, ...validRow, name: '' },
      { checked: true, ...validRow },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.rowErrors[0]?.name).toBeTruthy()
      expect(result.rowErrors[1]).toBeUndefined()
      expect(result.checkedCount).toBe(2)
    }
  })

  it('returns data and indexes for all checked valid rows', () => {
    const result = validateReceiptImportSelection([
      { checked: false, ...validRow, name: 'Skip' },
      { checked: true, ...validRow },
      { checked: true, name: 'Хляб', priceInput: '1,00', quantityInput: '1' },
    ])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(2)
      expect(result.checkedIndexes).toEqual([1, 2])
    }
  })
})

describe('validateReceiptImportItems', () => {
  it('validates batch of normalized items', () => {
    const result = validateReceiptImportItems([
      { name: 'Салата', unitPriceCents: 1250, quantity: 2 },
      { name: 'Хляб', unitPriceCents: 100, quantity: 1 },
    ])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toHaveLength(2)
  })

  it('returns indexed message on failure', () => {
    const result = validateReceiptImportItems([
      { name: 'Ок', unitPriceCents: 100, quantity: 1 },
      { name: '', unitPriceCents: 100, quantity: 1 },
    ])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('Артикул 2:')
      expect(result.index).toBe(1)
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run shared/receipt-import-schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schema**

```ts
// shared/receipt-import-schema.ts
import {
  validateItemAddArgs,
  validateItemAddForm,
} from './item-schema'
import type {
  ItemAddArgs,
  ItemAddData,
  ItemAddFormInput,
  ItemField,
} from './item-schema'

export type ReceiptImportRowInput = ItemAddFormInput

export type ReceiptImportRowWithSelection = ReceiptImportRowInput & {
  checked: boolean
}

export type ReceiptImportRowErrors = Partial<Record<ItemField, string>>

export function validateReceiptImportRow(
  input: ReceiptImportRowInput,
):
  | { ok: true; data: ItemAddData }
  | { ok: false; fieldErrors: ReceiptImportRowErrors } {
  return validateItemAddForm(input)
}

export function validateReceiptImportSelection(
  rows: ReceiptImportRowWithSelection[],
):
  | { ok: true; data: ItemAddData[]; checkedIndexes: number[] }
  | {
      ok: false
      rowErrors: Record<number, ReceiptImportRowErrors>
      checkedCount: number
    } {
  const data: ItemAddData[] = []
  const checkedIndexes: number[] = []
  const rowErrors: Record<number, ReceiptImportRowErrors> = {}
  let checkedCount = 0

  for (const [index, row] of rows.entries()) {
    if (!row.checked) continue
    checkedCount += 1

    const validated = validateReceiptImportRow({
      name: row.name,
      priceInput: row.priceInput,
      quantityInput: row.quantityInput,
    })

    if (!validated.ok) {
      rowErrors[index] = validated.fieldErrors
      continue
    }

    checkedIndexes.push(index)
    data.push(validated.data)
  }

  if (Object.keys(rowErrors).length > 0) {
    return { ok: false, rowErrors, checkedCount }
  }

  return { ok: true, data, checkedIndexes }
}

export function validateReceiptImportItems(
  items: ItemAddArgs[],
):
  | { ok: true; data: ItemAddData[] }
  | { ok: false; message: string; index?: number } {
  const data: ItemAddData[] = []

  for (const [index, item] of items.entries()) {
    const validated = validateItemAddArgs(item)
    if (!validated.ok) {
      return {
        ok: false,
        message: `Артикул ${index + 1}: ${validated.message}`,
        index,
      }
    }
    data.push(validated.data)
  }

  return { ok: true, data }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run shared/receipt-import-schema.test.ts`
Expected: PASS

---

## Task 2: Re-export shims

**Files:**
- Create: `src/lib/receipt-import-schema.ts`
- Create: `convex/lib/receiptImportSchema.ts`

- [ ] **Step 1: Client shim**

```ts
// src/lib/receipt-import-schema.ts
export {
  validateReceiptImportItems,
  validateReceiptImportRow,
  validateReceiptImportSelection,
} from '../../shared/receipt-import-schema'
export type {
  ReceiptImportRowErrors,
  ReceiptImportRowInput,
  ReceiptImportRowWithSelection,
} from '../../shared/receipt-import-schema'
```

- [ ] **Step 2: Convex shim**

```ts
// convex/lib/receiptImportSchema.ts
export { validateReceiptImportItems } from '../../shared/receipt-import-schema'
export type { ItemAddData } from '../../shared/item-schema'
```

---

## Task 3: Server — `importScannedItems`

**Files:**
- Modify: `convex/receiptScan.ts`

- [ ] **Step 1: Add import and capture bill from `requireBillOwner`**

```ts
import { validateReceiptImportItems } from './lib/receiptImportSchema'
```

At start of handler, after loading scan:

```ts
const bill = await requireBillOwner(ctx, scan.billId)
if (bill.status === 'final') {
  throw new ConvexError('Сметката е завършена.')
}
```

Remove the standalone `await requireBillOwner(ctx, scan.billId)` call if present elsewhere in handler.

- [ ] **Step 2: Validate items before replace/delete**

After resolving `itemsToImport`:

```ts
const validated = validateReceiptImportItems(itemsToImport)
if (!validated.ok) {
  throw new ConvexError(validated.message)
}
```

Replace loop body to use `validated.data` instead of `itemsToImport`:

```ts
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

**Order:** owner + finalized guard → resolve `itemsToImport` → validate → replace deletes (if `mode === 'replace'`) → inserts → restaurant patch (unchanged).

- [ ] **Step 3: Run Convex TypeScript**

Run: `npx convex codegen`
Expected: TypeScript passes

---

## Task 4: UI — `receipt-scan-review-sheet.tsx`

**Files:**
- Modify: `src/components/bills/receipt-scan-review-sheet.tsx`

- [ ] **Step 1: Update imports**

Remove: `parseEurInput` from `#/lib/format-currency.ts`

Add:

```ts
import { validateBillMetadataField } from '#/lib/bill-metadata-schema.ts'
import {
  validateReceiptImportRow,
  validateReceiptImportSelection,
} from '#/lib/receipt-import-schema.ts'
```

Do **not** import `#/lib/validation/index.ts`.

- [ ] **Step 2: Derive selection state and footer totals**

Replace loose `parsedRows` block:

```ts
const selectionInput = rows.map((row) => ({
  checked: row.checked,
  name: row.name,
  priceInput: row.priceInput,
  quantityInput: row.quantity,
}))

const selection = validateReceiptImportSelection(selectionInput)
const rowErrors = selection.ok === false ? selection.rowErrors : {}
const hasInvalidCheckedRows = selection.ok === false

const footerRows = rows.flatMap((row, index) => {
  if (!row.checked) return []
  const validated = validateReceiptImportRow({
    name: row.name,
    priceInput: row.priceInput,
    quantityInput: row.quantity,
  })
  if (!validated.ok) return []
  return [
    {
      name: validated.data.name,
      unitPriceCents: validated.data.unitPriceCents,
      quantity: validated.data.quantity,
      confidence: row.confidence,
    },
  ]
})

const itemsTotalCents = sumItemsCents(footerRows)
```

Keep `detectTotalsMismatch` + amber warning unchanged.

- [ ] **Step 3: Restaurant validation**

```ts
const restaurantValidation =
  updateRestaurantName
    ? validateBillMetadataField('restaurantName', restaurantName)
    : { ok: true as const }

const restaurantError =
  restaurantValidation.ok === false ? restaurantValidation.message : undefined
```

Show under restaurant `Input` when `restaurantError` is set:

```tsx
{restaurantError ? (
  <p className="text-xs text-destructive">{restaurantError}</p>
) : null}
```

- [ ] **Step 4: Per-row inline errors and row styling**

For each row, `const errors = rowErrors[index]`.

Row container classes:

```tsx
className={cn(
  'flex items-start gap-2 rounded-lg border p-3',
  row.checked && errors && 'border-destructive',
  row.confidence === 'low' &&
    !(row.checked && errors) &&
    'border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40',
)}
```

Name input — add `aria-invalid={Boolean(errors?.name)}` and error text below (match `ItemList` `text-xs text-destructive` pattern).

Price input — `aria-invalid={Boolean(errors?.price)}` + error below.

Quantity input — `aria-invalid={Boolean(errors?.quantity)}` + error below.

Optional: clear field error on change (not required — derived `rowErrors` recomputes on render).

- [ ] **Step 5: Import button disabled state**

```tsx
disabled={
  isSubmitting ||
  checkedCount === 0 ||
  hasInvalidCheckedRows ||
  (updateRestaurantName && restaurantValidation.ok === false)
}
```

- [ ] **Step 6: Rewrite `handleImport`**

```ts
async function handleImport() {
  if (checkedCount === 0) {
    toast.error('Изберете поне един артикул за импортиране')
    return
  }

  const selection = validateReceiptImportSelection(selectionInput)
  if (!selection.ok) return

  if (updateRestaurantName) {
    const restaurant = validateBillMetadataField(
      'restaurantName',
      restaurantName,
    )
    if (!restaurant.ok) return
  }

  setIsSubmitting(true)
  try {
    await importScannedItems({
      scanId,
      mode: importMode,
      selectedIndexes: selection.checkedIndexes,
      updateRestaurantName,
      restaurantName: updateRestaurantName ? restaurantName : undefined,
      items: selection.data.map((item) => ({
        name: item.name,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
      })),
    })
    await dismissScan({ scanId })
    toast.success(`${selection.data.length} артикула добавени`)
    onOpenChange(false)
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : 'Неуспешен импорт на артикулите.',
    )
  } finally {
    setIsSubmitting(false)
  }
}
```

Remove `parseEurInput`, `Math.max(1, parseInt || 1)`, and empty-name filter.

---

## Task 5: Docs & verification

**Files:**
- Modify: `docs/superpowers/specs/2026-07-09-val-6-receipt-import-design.md` — Status → Approved
- Modify: `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md` — VAL-6 → ✅ Done, exit criteria checked

- [ ] **Step 1: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass

- [ ] **Step 2: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

- [ ] **Step 3: Manual QA**

1. Scan receipt → review sheet opens with all rows checked
2. Clear name on checked row → inline error; import button disabled
3. Set price to `"abc"` → price error; import disabled
4. Set qty to `0` → qty error; import disabled
5. Uncheck invalid row → import enabled (if other checked rows valid)
6. Valid import → items appear on bill; scan dismissed
7. Replace mode with one invalid checked row → blocked client-side
8. Restaurant checkbox on + overlong name → inline error; import disabled
9. Finalized bill → import fails server-side with `Сметката е завършена.`
10. Totals mismatch amber warning still shows when sums differ

- [ ] **Step 4: Update plan status**

Mark this plan **Status:** ✅ Complete

- [ ] **Step 5: Remind deploy**

After Convex changes: `npx convex deploy`

---

## Self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| `shared/receipt-import-schema.ts` + tests | Task 1 |
| OCR junk row cases (empty name, bad price, bad qty) | Task 1 |
| Re-export shims (no `#/lib/validation/index.ts` on client) | Task 2 |
| `importScannedItems` validates all items | Task 3 |
| Finalized bill guard before writes | Task 3 |
| `extractedItems` fallback validated on server | Task 3 |
| Per-row inline errors on checked rows | Task 4 |
| Import blocked when checked rows invalid | Task 4 |
| Restaurant client validation when checkbox on | Task 4 |
| Remove `parseEurInput` / silent qty clamp | Task 4 |
| Strict footer sum (valid checked rows only) | Task 4 |
| Roadmap / spec status update | Task 5 |

---

**Next after completion:** Validation program complete (VAL-0–VAL-6). Say **`1`** to execute this plan inline.
