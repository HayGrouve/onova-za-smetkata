# VAL-1 — Bill Metadata Validation (Scoped Design)

**Date:** 2026-07-09  
**Status:** Approved  
**Parent:** `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md`  
**Depends on:** VAL-0 (`shared/validation/`)  
**Scope:** Restaurant, note, tip, and date on draft bills — inline errors + server enforcement

---

## Goal

Validate the four editable bill metadata fields using shared VAL-0 primitives, with the same client/server pattern as payment settings. Users see field-level errors while editing; Convex rejects invalid patches.

---

## Non-goals

- Participant, item, or payment validation (VAL-2–VAL-4)
- Receipt row validation (VAL-6) — only restaurant name on OCR apply is in scope here
- Changing finalize business rules beyond aligning error messages
- Real-time validation on every keystroke before debounce fires

---

## Surfaces

| Field                  | UI                                 | Mutation / path                   |
| ---------------------- | ---------------------------------- | --------------------------------- |
| `restaurantName`       | Bill editor — „Ресторант“          | `bills.update`                    |
| `tipCents`             | Bill editor — „Бакшиш“ (EUR input) | `bills.update`                    |
| `note`                 | Advanced settings — „Бележка“      | `bills.update`                    |
| `date`                 | Advanced settings — `type="date"`  | `bills.update`                    |
| `restaurantName` (OCR) | Receipt scan apply                 | `receiptScan.apply` (server only) |

`receiptStorageId` is unchanged — not part of this spec.

---

## Validation rules

Composed from VAL-0 field schemas in `shared/bill-metadata-schema.ts`:

| Field      | Input (client)      | Stored value              | Rules                                                                                     |
| ---------- | ------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| Restaurant | string              | string (trimmed)          | `restaurantNameSchema()` — optional empty while draft; max 80 chars                       |
| Note       | string              | `string \| undefined`     | `optionalNoteSchema()` — blank → `undefined`; max 500 chars                               |
| Tip        | EUR string          | `number` (cents)          | Empty/blank → `0`; otherwise `parseEurInputStrict` → `nonNegativeCentsSchema('Бакшишът')` |
| Date       | `YYYY-MM-DD` string | epoch ms (local midnight) | Parse to ms → `billDateSchema`                                                            |

### Restaurant required at finalize only

Draft bills may keep an empty restaurant name. Finalize already fails with `Въведете име на ресторант.` — unchanged. Inline hint under restaurant field when empty is optional (not required for VAL-1).

### Tip empty behavior

| Input                        | `tipCents` saved                |
| ---------------------------- | ------------------------------- |
| `""`, `" "`, `"0"`, `"0,00"` | `0`                             |
| `"12,50"`                    | `1250`                          |
| `"abc"`, `"-"`               | Invalid — no save; inline error |

Replaces silent `parseEurInput → 0` for invalid tip strings.

### Date parsing

Keep existing `fromDateInputValue` / `toDateInputValue` helpers in bill editor. Schema validates the resulting epoch ms. Invalid browser date strings should not reach the server (client validates before save).

---

## Shared schema API

**File:** `shared/bill-metadata-schema.ts`  
**Tests:** `shared/bill-metadata-schema.test.ts`  
**Shims:** `src/lib/bill-metadata-schema.ts`, `convex/lib/billMetadataSchema.ts`

```ts
// Patch shape — only keys present in the mutation args
export type BillMetadataPatchInput = {
  restaurantName?: string
  note?: string
  tipCents?: number
  date?: number
}

// Client tip helper
export function parseTipInputToCents(
  value: string,
): { ok: true; cents: number } | { ok: false; message: string }

export function parseBillMetadataPatch(
  patch: BillMetadataPatchInput,
): z.SafeParseReturnType<BillMetadataPatchInput, BillMetadataPatchData>

export function formatBillMetadataErrors(
  error: z.ZodError,
): Partial<Record<'restaurantName' | 'note' | 'tip' | 'date', string>>
```

`parseBillMetadataPatch` validates **only keys that are present** (`undefined` = not in patch). Each provided key must pass its field schema. Output normalizes: trimmed restaurant, note `undefined` when empty, etc.

---

## Server behavior

### `bills.update`

Before `ctx.db.patch`:

1. Build patch object from provided args (exclude `billId`)
2. `parseBillMetadataPatch(patch)` — if fail → `ConvexError(firstZodIssueMessage(...))`
3. Apply normalized values from parsed output

`assertNonNegativeIntCents` for tip is **replaced** by schema (same rules, single path).

### `receiptScan.apply`

When `updateRestaurantName` and a restaurant string is applied:

- Run through `restaurantNameSchema()` (not required)
- On failure → `ConvexError` with field message
- On success → store trimmed value

---

## Client behavior

### State

In `BillEditorContent`:

```ts
const [fieldErrors, setFieldErrors] = useState<{
  restaurantName?: string
  note?: string
  tip?: string
  date?: string
}>({})
```

### Debounced save strategy

**Skip save when the changed field is invalid.** Local input state still updates (user can fix typing).

Flow per field change:

1. Update local React state (unchanged)
2. Validate **only the field being saved** (or the patch about to be sent)
3. If invalid → `setFieldErrors` for that field; **do not** call `updateBill`
4. If valid → clear that field's error; call `scheduleSave` with normalized patch value

This avoids partial corrupt writes and matches payment-settings “block submit” semantics without fighting debounce.

### Inline errors

| Field      | Location                   | Pattern                                   |
| ---------- | -------------------------- | ----------------------------------------- |
| Restaurant | Below input in bill editor | `aria-invalid`, `text-destructive` helper |
| Tip        | Below tip input            | Same                                      |
| Note       | `BillAdvancedSettings`     | Pass `noteError` prop                     |
| Date       | `BillAdvancedSettings`     | Pass `dateError` prop                     |

Clear field error on `onChange` when that field currently has an error (payment-settings pattern).

### `BillAdvancedSettings` changes

Extend props:

```ts
noteError?: string
dateError?: string
onNoteChange: (value: string) => void
onDateChange: (value: string) => void
```

Parent owns validation; child displays errors.

---

## Error message alignment

| Scenario                          | Message source                                   |
| --------------------------------- | ------------------------------------------------ |
| Empty restaurant at finalize      | `Въведете име на ресторант.` (existing finalize) |
| Restaurant too long while editing | `Името може да е до 80 символа`                  |
| Invalid tip                       | `Невалидна сума.`                                |
| Note too long                     | `Бележката може да е до 500 символа`             |
| Invalid date                      | `Невалидна дата.`                                |

---

## Files

| File                                              | Action                                  |
| ------------------------------------------------- | --------------------------------------- |
| `shared/bill-metadata-schema.ts`                  | Create                                  |
| `shared/bill-metadata-schema.test.ts`             | Create                                  |
| `src/lib/bill-metadata-schema.ts`                 | Create — re-export                      |
| `convex/lib/billMetadataSchema.ts`                | Create — re-export                      |
| `convex/bills.ts`                                 | Validate patch in `update`              |
| `convex/receiptScan.ts`                           | Validate restaurant on apply            |
| `src/routes/bills/$billId/index.tsx`              | Field errors + validated `scheduleSave` |
| `src/components/bills/bill-advanced-settings.tsx` | Display note/date errors                |

---

## Testing

### Schema tests (`bill-metadata-schema.test.ts`)

- Restaurant: empty OK, over max fails, trim applied
- Note: blank → `undefined`, over max fails
- Tip cents: `0` OK, negative fails, overflow fails
- Tip input: `""` → 0, `12,50` → 1250, `abc` fails
- Date: valid ms OK, pre-2000 fails, >1 year future fails
- Patch: only validates present keys; omits `undefined` keys

### Manual QA

1. Type 81-char restaurant → inline error, no save toast
2. Fix restaurant → saves after debounce
3. Enter `abc` in tip → error; enter `5,00` → saves
4. Clear tip → saves as 0
5. Note over 500 chars → error in advanced settings
6. Invalid date edge case (if reproducible) → error, no save
7. OCR apply with overlong restaurant name → server error toast

---

## Exit criteria

- [ ] `shared/bill-metadata-schema.ts` + tests pass
- [ ] `bills.update` and `receiptScan.apply` use shared parser
- [ ] Inline errors on all four fields in bill editor UI
- [ ] Invalid tip no longer silently becomes `0` from garbage input
- [ ] `pnpm run preflight` passes
- [ ] Roadmap VAL-1 marked ✅

---

## Next phase

**VAL-2 Participants** — `personNameSchema`, duplicate detection on `participants.add`.
