# VAL-0 — Validation Framework (Scoped Design)

**Date:** 2026-07-09  
**Status:** Approved  
**Parent:** `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md`  
**Scope:** Shared Zod primitives, error helpers, and conventions — no new user-facing validation rules yet

---

## Goal

Give every future validation phase (VAL-1–VAL-6) a single place for reusable field rules and error formatting, matching the payment-settings pattern without duplicating logic.

---

## Non-goals

- No new validation on bill/participant/item forms in this phase
- No UI changes visible to users (unless refactoring payment/friend-group imports causes none)
- No `use-field-validation` hook unless trivial — prefer explicit `safeParse` + `setFieldErrors` in components (YAGNI)

---

## File layout

```
shared/validation/
  constants.ts      # Max lengths, caps (single source for cross-phase limits)
  fields.ts         # Reusable Zod schemas + parsers
  errors.ts         # formatZodFieldErrors, firstIssueMessage
  eur.ts            # parseEurInputToCents (strict) — replaces silent-0 behavior for validated paths
  fields.test.ts
  errors.test.ts
  eur.test.ts

src/lib/validation/
  index.ts          # Re-export shared/validation for client

convex/lib/validation.ts   # Re-export for Convex handlers
```

Domain schemas (VAL-1+) compose from `shared/validation/fields.ts`:

```
shared/bill-metadata-schema.ts   # VAL-1
shared/participant-schema.ts     # VAL-2
shared/item-schema.ts            # VAL-3
...
```

---

## Constants (`shared/validation/constants.ts`)

Central caps referenced by field schemas and documented for later phases:

| Constant                | Value   | Used in                           |
| ----------------------- | ------- | --------------------------------- |
| `PERSON_NAME_MAX`       | 50      | VAL-2 participants, friend groups |
| `RESTAURANT_NAME_MAX`   | 80      | VAL-1                             |
| `GROUP_NAME_MAX`        | 40      | friend groups (existing)          |
| `NOTE_MAX`              | 500     | VAL-1 bill note, VAL-3 item note  |
| `PAYMENT_NOTE_MAX`      | 200     | VAL-4                             |
| `ITEM_NAME_MAX`         | 120     | VAL-3                             |
| `QUANTITY_MAX`          | 999     | VAL-3                             |
| `EUR_CENTS_MAX`         | 999_900 | €9 999 sanity cap                 |
| `BILL_PARTICIPANTS_MAX` | 50      | VAL-2                             |
| `DEVICE_ID_MAX`         | 64      | VAL-5                             |

---

## Field schemas (`shared/validation/fields.ts`)

Each export is a **function** returning a schema so messages can stay contextual, or a plain schema where sufficient.

### `personNameSchema`

```ts
z.string()
  .trim()
  .min(1, 'Името не може да е празно')
  .max(PERSON_NAME_MAX, `Името може да е до ${PERSON_NAME_MAX} символа`)
  .refine((s) => !/[\x00-\x1f]/.test(s), 'Името съдържа невалидни символи')
```

### `restaurantNameSchema({ required?: boolean })`

- Trim
- When `required: true` → min 1 with message `Въведете име на ресторант.` (matches finalize)
- When `required: false` → allow empty string (draft bills)
- Max `RESTAURANT_NAME_MAX`

### `optionalNoteSchema(max = NOTE_MAX)`

- Input: string
- Output: `string | undefined` — empty/whitespace → `undefined`
- Max length with message `Бележката може да е до N символа`

### `quantityInputSchema`

- Input: string or number (forms may pass either)
- Output: positive int 1..`QUANTITY_MAX`
- Messages: `Количеството трябва да е поне 1.`, `Количеството е твърде голямо.`

### `nonNegativeCentsSchema(label = 'Сумата')`

- Input: number (already cents)
- Integer ≥ 0, ≤ `EUR_CENTS_MAX`

### `positiveCentsSchema(label = 'Сумата')`

- Input: number (already cents)
- Integer ≥ 1, ≤ `EUR_CENTS_MAX`

### `billDateSchema`

- Input: number (epoch ms)
- Range: `2000-01-01` .. `now + 365 days`
- Message: `Невалидна дата.`

### `deviceIdSchema`

- Optional string; trim; max `DEVICE_ID_MAX`; empty → `undefined`

---

## EUR parsing (`shared/validation/eur.ts`)

Strict parser for form inputs — **differs** from `src/lib/format-currency.ts` `parseEurInput` which returns `0` on NaN.

```ts
export function parseEurInputStrict(
  value: string,
): { ok: true; cents: number } | { ok: false; message: string }
```

Rules:

- Trim; allow `,` or `.` as decimal separator
- Reject empty, non-numeric, negative
- Round to int cents (same as existing `Math.round(parsed * 100)`)
- Reject > `EUR_CENTS_MAX` cents
- Message on failure: `Невалидна сума.`

`parseEurInput` in `format-currency.ts` **stays** for display/back-compat; validated forms use `parseEurInputStrict` via Zod `superRefine` or dedicated `eurInputSchema` wrapper.

```ts
export const eurInputSchema = (label = 'Сумата') =>
  z.string().superRefine((raw, ctx) => {
    const result = parseEurInputStrict(raw)
    if (!result.ok) ctx.addIssue({ code: 'custom', message: result.message })
  }).transform((raw) => parseEurInputStrict(raw).ok ? ... : never)
```

(Implementation uses shared helper; spec requires strict behavior.)

---

## Error helpers (`shared/validation/errors.ts`)

### `formatZodFieldErrors<T extends string>(error: z.ZodError, fields: readonly T[])`

Returns `Partial<Record<T, string>>` — first issue per top-level field path.

Handles nested paths: `['memberNames', 2]` → caller-specific formatters (friend groups keep `formatFriendGroupErrors`).

### `firstZodIssueMessage(error: z.ZodError, fallback: string)`

For Convex mutations: `throw new ConvexError(firstZodIssueMessage(parsed.error, 'Невалидни данни'))`

---

## Convex integration pattern

```ts
// convex/lib/validation.ts
export * from '../../shared/validation/errors'
export * from '../../shared/validation/constants'
// fields as needed per mutation file

// convex/bills.ts (VAL-1 example)
const parsed = parseBillMetadataPatch(args)
if (!parsed.success) {
  throw new ConvexError(
    firstZodIssueMessage(parsed.error, 'Невалидни данни за сметката'),
  )
}
```

Shim file name: `convex/lib/validation.ts` (no hyphen; matches `billCalculations.ts` convention).

---

## Client integration pattern

```tsx
const parsed = parseBillMetadataInput({ restaurantName, note, tip, date })
if (!parsed.success) {
  setFieldErrors(
    formatZodFieldErrors(parsed.error, [
      'restaurantName',
      'note',
      'tip',
      'date',
    ]),
  )
  return
}
await updateBill({ billId, ...parsed.data })
```

Clear field error on `onChange` when that field had an error (existing payment-settings behavior).

---

## Optional refactor (zero behavior change)

Align existing schemas to import shared fragments **without changing messages or limits**:

| File                                | Change                                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `shared/friend-group-schema.ts`     | `memberNameSchema` → `personNameSchema`; `groupName` uses `GROUP_NAME_MAX` from constants |
| `shared/payment-settings-schema.ts` | No change (domain-specific IBAN/Revolut logic stays local)                                |

If refactor risks message drift, skip and document "migrate in VAL-2".

---

## Testing

| File             | Cases                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `fields.test.ts` | personName empty/trim/max; restaurant required vs optional; note empty→undefined; quantity bounds |
| `eur.test.ts`    | `12,50` → 1250; empty → error; `abc` → error; negative → error; overflow → error                  |
| `errors.test.ts` | Multi-field ZodError → correct partial map; first issue extraction                                |

Run: `pnpm run test`

---

## Exit criteria

- [ ] `shared/validation/*` created with tests passing
- [ ] `src/lib/validation/index.ts` and `convex/lib/validation.ts` re-exports
- [ ] Roadmap VAL-0 row marked ✅
- [ ] No user-visible behavior change
- [ ] `pnpm run preflight` passes

---

## Files touched

| File                                                          | Action              |
| ------------------------------------------------------------- | ------------------- |
| `shared/validation/constants.ts`                              | Create              |
| `shared/validation/fields.ts`                                 | Create              |
| `shared/validation/eur.ts`                                    | Create              |
| `shared/validation/errors.ts`                                 | Create              |
| `shared/validation/*.test.ts`                                 | Create              |
| `src/lib/validation/index.ts`                                 | Create              |
| `convex/lib/validation.ts`                                    | Create              |
| `shared/friend-group-schema.ts`                               | Optional refactor   |
| `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md` | Update VAL-0 status |

---

## Next phase

After VAL-0 implementation: **VAL-1 Bill metadata** using `restaurantNameSchema`, `optionalNoteSchema`, `eurInputSchema`, `billDateSchema`.
