# VAL-3 — Items Validation (Scoped Design)

**Date:** 2026-07-09  
**Status:** Approved  
**Parent:** `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md`  
**Depends on:** VAL-0 (`parseEurInputStrict`, `quantityInputSchema`, `nonNegativeCentsSchema`, `ITEM_NAME_MAX`, `PAYMENT_NOTE_MAX`)  
**Scope:** Item name, unit price, quantity, and note on add/update — inline errors + server enforcement

---

## Goal

Validate bill line items using shared VAL-0 primitives, with the same client/server pattern as VAL-1 (debounced inline edit) and VAL-2 (add form). Users see field-level errors while adding or editing items; Convex rejects invalid mutations. **Remove** silent `parseEurInput → 0` and silent quantity clamp (`Math.max(1, parseInt || 1)`) on validated paths.

---

## Non-goals

- Receipt scan row validation (VAL-6) — `receiptScan.apply` item import unchanged
- Payment amount validation (VAL-4)
- Assignment / unit-clamp business rules (stay in `items.update` + `assignments`)
- Item note UI (no note field in `ItemList` today — server validates `note` for API/undo paths only)
- Per-bill item count cap (none exists today)
- Changing finalize rules (zero-price items may still exist; finalize already blocks unassigned items)

---

## Surfaces

| Action | UI | Mutation |
|--------|-----|----------|
| Add item | `ItemList` dashed form | `items.add` |
| Edit name | `ItemRow` inline input | `items.update` |
| Edit unit price | `ItemRow` EUR input | `items.update` |
| Edit quantity | `ItemRow` qty input | `items.update` |
| Undo delete | Toast „Отмени“ | `items.add` (re-insert with prior fields) |
| Note (API only) | — | `items.add` / `items.update` |

---

## Validation rules

Composed in `shared/item-schema.ts` from VAL-0 primitives. Add `itemNameSchema` to `shared/validation/fields.ts` (trim; 1–`ITEM_NAME_MAX`; no control-char rule — same as restaurant names).

| Field | Add form input | Inline edit input | Stored value | Rules |
|-------|----------------|-------------------|--------------|-------|
| Name | string | string | trimmed string | `itemNameSchema` |
| Unit price | EUR string | EUR string | int cents ≥ 0 | Add/edit input: `parseEurInputStrict` → `nonNegativeCentsSchema('Цената')` |
| Quantity | string (default `"1"`) | string | int ≥ 1 | `quantityInputSchema` (max `QUANTITY_MAX` = 999) |
| Note | — | — | `string \| undefined` | `optionalNoteSchema(PAYMENT_NOTE_MAX)` — blank → `undefined` |

### Price semantics

| Context | Input | Result |
|---------|-------|--------|
| Add — empty / whitespace | `""`, `" "` | Invalid — inline error; no mutation |
| Add — invalid | `"abc"`, `"-"` | Invalid — inline error; no mutation |
| Add — valid zero | `"0"`, `"0,00"` | `unitPriceCents: 0` (allowed; finalize may still require priced assignments separately) |
| Add — valid | `"12,50"` | `1250` |
| Inline edit — invalid | same as add | Inline error; **skip debounced save** |
| Inline edit — valid | `"3,99"` | Save `399` |

Replaces `parseEurInput` in `item-list.tsx` for all item add/edit paths.

### Quantity semantics

| Context | Input | Result |
|---------|-------|--------|
| Add — empty / invalid | `""`, `"0"`, `"abc"` | Invalid — inline error on submit |
| Add — valid | `"1"` … `"999"` | Parsed int saved |
| Inline edit — invalid | `""`, `"0"`, `"1000"` | Inline error; skip debounced save |
| Inline edit — valid | `"2"` | Save `2` |

Replaces silent `Math.max(1, Number.parseInt(...) || 1)` in `ItemRow`.

### Error messages

| Field | Source |
|-------|--------|
| Name empty | `Наименованието не може да е празно` (new `itemNameSchema` message) |
| Name too long | `Наименованието може да е до 120 символа` |
| Price invalid / empty | `Невалидна сума.` (from `parseEurInputStrict`) |
| Quantity | From `quantityInputSchema` (`Количеството трябва да е поне 1.` / `Количеството е твърде голямо.`) |
| Note too long | `Бележката може да е до 200 символа` |
| Finalized bill | `Сметката е завършена.` |
| Qty reduction blocked | `Намалете разпределенията преди да намалите количеството.` (existing business rule — unchanged) |

### Finalized bill

Match `participants.add`: block structural edits on finalized bills.

- `items.add` — reject when `bill.status === 'final'`
- `items.update` — reject when `bill.status === 'final'`
- `items.remove` — unchanged (no finalized guard today; out of scope unless product asks)

---

## Shared schema API

**File:** `shared/item-schema.ts`  
**Tests:** `shared/item-schema.test.ts`  
**Shims:** `src/lib/item-schema.ts`, `convex/lib/itemSchema.ts`

```ts
export type ItemAddFormInput = {
  name: string
  priceInput: string
  quantityInput: string | number
  note?: string
}

export type ItemAddArgs = {
  name: string
  unitPriceCents: number
  quantity?: number
  note?: string
}

export type ItemUpdatePatchInput = {
  name?: string
  unitPriceCents?: number
  quantity?: number | string
  note?: string
}

export type ItemField = 'name' | 'price' | 'quantity' | 'note'

export function parseItemPriceInput(
  value: string,
): { ok: true; cents: number } | { ok: false; message: string }

export function validateItemAddForm(
  input: ItemAddFormInput,
):
  | { ok: true; data: { name: string; unitPriceCents: number; quantity: number; note?: string } }
  | { ok: false; fieldErrors: Partial<Record<ItemField, string>> }

export function validateItemAddArgs(
  args: ItemAddArgs,
):
  | { ok: true; data: { name: string; unitPriceCents: number; quantity: number; note?: string } }
  | { ok: false; message: string }

export function validateItemUpdatePatch(
  patch: ItemUpdatePatchInput,
):
  | { ok: true; data: Partial<{ name: string; unitPriceCents: number; quantity: number; note?: string }> }
  | { ok: false; message: string }

// Client inline edit — validate single field from raw input
export function validateItemNameInput(value: string): string | undefined
export function validateItemPriceInput(value: string): string | undefined
export function validateItemQuantityInput(value: string): string | undefined

export function formatItemFieldErrors(
  error: z.ZodError,
): Partial<Record<ItemField, string>>
```

`validateItemAddForm` order:

1. `itemNameSchema` on `name`
2. `parseItemPriceInput` on `priceInput` (required on add — empty fails)
3. `quantityInputSchema` on `quantityInput` (default `"1"` in UI if unset)
4. `optionalNoteSchema(PAYMENT_NOTE_MAX)` on `note` when provided

`validateItemUpdatePatch` validates **only keys present** (`undefined` = not in patch), same pattern as `parseBillMetadataPatch`.

---

## Server behavior

### `items.add`

```ts
const bill = await requireBillOwner(ctx, args.billId)
if (bill.status === 'final') {
  throw new ConvexError('Сметката е завършена.')
}

const validated = validateItemAddArgs({
  name: args.name,
  unitPriceCents: args.unitPriceCents,
  quantity: args.quantity,
  note: args.note,
})
if (!validated.ok) {
  throw new ConvexError(validated.message)
}

await ctx.db.insert('items', {
  billId: args.billId,
  name: validated.data.name,
  unitPriceCents: validated.data.unitPriceCents,
  quantity: validated.data.quantity,
  note: validated.data.note,
  sortOrder: existing.length,
})
```

Replace `assertNonNegativeIntCents` / `assertPositiveQuantity` in add handler with schema output (same rules, single path).

### `items.update`

```ts
const item = await ctx.db.get(args.itemId)
// ... not found guard ...

const bill = await requireBillOwner(ctx, item.billId)
if (bill.status === 'final') {
  throw new ConvexError('Сметката е завършена.')
}

const validated = validateItemUpdatePatch({
  name: args.name,
  unitPriceCents: args.unitPriceCents,
  quantity: args.quantity,
  note: args.note,
})
if (!validated.ok) {
  throw new ConvexError(validated.message)
}

// Existing qty-reduction vs assignments check — unchanged, runs after schema
// Apply validated.data patch
```

`assertNonNegativeIntCents` / `assertPositiveQuantity` removed from update handler; schema covers format validation.

---

## Client behavior

### Add form (`ItemList`)

```ts
const [fieldErrors, setFieldErrors] = useState<{
  name?: string
  price?: string
  quantity?: string
}>({})

async function handleAdd() {
  const validated = validateItemAddForm({
    name: newName,
    priceInput: newPrice,
    quantityInput: newQuantity,
  })
  if (!validated.ok) {
    setFieldErrors(validated.fieldErrors)
    return
  }
  setFieldErrors({})
  // clear inputs, mutate with validated.data
}
```

- Per-field errors under name / price / quantity inputs (`aria-invalid`, `text-xs text-destructive`)
- Clear field error on `onChange` when that field has an error (VAL-1 pattern)
- Submit button: keep `disabled={!newName.trim()}`; full validation on click (covers paste edge cases)
- Toast on server failure (`getConvexErrorMessage`) — unchanged

### Inline edit (`ItemRow`)

Per-row `fieldErrors` state: `{ name?: string; price?: string; quantity?: string }`.

Debounced save strategy (match bill editor `scheduleValidatedSave`):

1. Update local React state immediately
2. Validate **only the field being saved**
3. If invalid → `setFieldErrors` for that field; **do not** call `updateItem`
4. If valid → clear that field's error; debounce `updateItem` with normalized value

```ts
function scheduleItemFieldSave(
  field: 'name' | 'price' | 'quantity',
  raw: string,
  patch: { name?: string; unitPriceCents?: number; quantity?: number },
) {
  const error =
    field === 'name'
      ? validateItemNameInput(raw)
      : field === 'price'
        ? validateItemPriceInput(raw)
        : validateItemQuantityInput(raw)

  if (error) {
    setFieldErrors((prev) => ({ ...prev, [field]: error }))
    return
  }
  setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  debouncedSave(patch)
}
```

- Show inline errors under each input in the row
- Wrap `updateItem` in try/catch; toast on server errors (e.g. qty-reduction blocked) — today errors are silent

### Read-only mode (consistency)

Pass `readOnly={bill.status === 'final'}` from bill editor to `ItemList` (same as `ParticipantList`):

- Hide dashed add form when `readOnly`
- Disable inline inputs and delete button on existing rows
- Server finalized guard remains the source of truth

---

## Files

| File | Action |
|------|--------|
| `shared/validation/fields.ts` | Add `itemNameSchema` |
| `shared/item-schema.ts` | Create |
| `shared/item-schema.test.ts` | Create |
| `src/lib/item-schema.ts` | Create — re-export |
| `convex/lib/itemSchema.ts` | Create — re-export |
| `convex/items.ts` | Schema in `add` / `update`; finalized guard; remove `assert*` for format |
| `src/components/bills/item-list.tsx` | Add form + `ItemRow` inline errors; strict parsers; `readOnly` prop |
| `src/routes/bills/$billId/index.tsx` | Pass `readOnly` to `ItemList` |

---

## Testing

### Schema tests (`shared/item-schema.test.ts`)

- Valid add trims name and parses `"12,50"` → `1250` cents
- Comma decimal: `"3,99"` → `399`
- Empty name fails
- Name at 120 chars passes; 121 fails
- Empty price on add fails
- Invalid price `"abc"` fails
- Zero price `"0,00"` passes with `0` cents
- Quantity `1`, `999` pass; `0`, `1000`, `""` fail
- Note blank → `undefined`; 201 chars fails
- Update patch with only `name` does not require price/qty
- `validateItemUpdatePatch` rejects negative cents

### Manual QA

1. Add item with name only → price error under price field
2. Add `"abc"` as price → inline error; item not created
3. Add `"12,50"` × `2` → success; totals update
4. Inline edit price to `"-"` → error; no server write until fixed
5. Inline edit qty to `0` → error; no silent revert to `1`
6. Reduce qty below assigned units → server toast (existing rule)
7. Finalized bill → add form hidden; inline edit disabled; direct mutation returns `Сметката е завършена.`
8. Undo delete after valid add → restored item matches prior values

---

## Exit criteria

- [x] `itemNameSchema` in `shared/validation/fields.ts`
- [x] `shared/item-schema.ts` + tests pass (including comma decimal)
- [x] `items.add` / `items.update` parse through shared schema
- [x] Add form shows name / price / qty errors inline
- [x] `ItemRow` shows per-field errors; invalid fields skip debounced save
- [x] No `parseEurInput` / silent qty clamp on item paths
- [x] `readOnly` passed to `ItemList` on finalized bills
- [x] `pnpm run preflight` passes
- [x] Roadmap VAL-3 marked ✅

---

## Next phase

**VAL-4 — Payments** (`docs/superpowers/specs/2026-07-09-val-4-payments-design.md`): partial payment amount + optional note; reuses `parseEurInputStrict` patterns from VAL-3.
