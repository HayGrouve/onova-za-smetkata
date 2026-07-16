# VAL-4 — Payments Validation (Scoped Design)

**Date:** 2026-07-09  
**Status:** Approved  
**Parent:** `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md`  
**Depends on:** VAL-0 (`parseEurInputStrict`, `positiveCentsSchema`, `PAYMENT_NOTE_MAX`)  
**Scope:** Partial payment amount on `PaymentActions` — inline errors + server enforcement

---

## Goal

Validate payment amounts using shared VAL-0 primitives, with the same client/server pattern as VAL-2 (add form) and VAL-3 (strict EUR input). Users see an inline error on invalid partial amounts; Convex rejects bad amounts before the existing owed-cap business rule. **Remove** silent `parseEurInput → 0` and silent `if (amountCents <= 0) return` on the partial-payment path.

---

## Non-goals

- Payment note UI (no note field in `PaymentActions` today — server validates `note` for API paths only)
- `payments.undoLast` (no amount input)
- Guest copy-to-clipboard pay flows (`guest-claim-footer`, `ParticipantPayActions`) — no free-text amount entry
- Finalized-bill guard on payments (recording payments on finalized bills is allowed)
- Changing owed/balance calculation (`calculateBillTotals`)
- Payment settings validation (already done pre-roadmap)

---

## Surfaces

| Action          | UI                                   | Mutation                                       |
| --------------- | ------------------------------------ | ---------------------------------------------- |
| Partial payment | `PaymentActions` EUR input + „Плати“ | `payments.add`                                 |
| Mark full paid  | „Платено“ button (no field)          | `payments.add` (`amountCents: remainingCents`) |
| Note (API only) | —                                    | `payments.add`                                 |

`PaymentActions` is rendered from `PaymentRow` and `participant-breakdown-content` on the summary/breakdown views.

---

## Validation rules

Composed in `shared/payment-amount-schema.ts` from VAL-0 primitives.

| Field  | Partial input   | Mark-full button        | Stored value          | Rules                                                                                 |
| ------ | --------------- | ----------------------- | --------------------- | ------------------------------------------------------------------------------------- |
| Amount | EUR string      | `remainingCents` number | int cents > 0         | `parseEurInputStrict` → `positiveCentsSchema('Сумата')`                               |
| Cap    | client + server | server only             | —                     | `amountCents ≤ remainingCents` where `remainingCents = max(0, owedCents - paidCents)` |
| Note   | —               | —                       | `string \| undefined` | `optionalNoteSchema(PAYMENT_NOTE_MAX)` when provided                                  |

### Amount semantics (partial payment)

| Input              | Result                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Empty / whitespace | Invalid — inline error on submit; button stays disabled when `!trim()` |
| Invalid            | `"abc"`, `"-"` → `Невалидна сума.`; no mutation                        |
| Zero               | `"0"`, `"0,00"` → Invalid — `Сумата трябва да е положителна.`          |
| Valid              | `"12,50"` → `1250`                                                     |
| Over remaining     | Inline error `Сумата надвишава дължимото.`; no mutation                |
| Exact remaining    | Allowed (equivalent to mark-full)                                      |

Replaces `parseEurInput` in `payment-actions.tsx` for partial payments.

### Mark-full paid semantics

- Button only rendered when `remainingCents > 0` (unchanged)
- Sends `amountCents: remainingCents` — no EUR string parsing
- Server runs same `validatePaymentAdd` with computed `owedCents` / `paidCents`; cap check must pass by construction
- No inline amount field — no client schema on the button path beyond existing guard

### Error messages

| Code                 | Message                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| Invalid / empty EUR  | `Невалидна сума.` (from `parseEurInputStrict`)                              |
| Non-positive         | `Сумата трябва да е положителна.` (from `positiveCentsSchema`)              |
| Over cap             | `Сумата надвишава дължимото.` (existing server message — reuse client-side) |
| Participant mismatch | `Участникът не принадлежи на тази сметка.` (unchanged)                      |
| Note too long        | `Бележката може да е до 200 символа`                                        |

### Cap semantics

- **Client:** `remainingCents` from `totals.balanceCents` (already `max(0, owed - paid)` in `PaymentActions`)
- **Server:** recompute `owedCents` and `paidCents` from DB via `calculateBillTotals` + payments query (unchanged source of truth)
- Schema validates format first; cap check runs after format passes
- Strict inequality: `paidCents + amountCents > owedCents` → reject (allows paying exactly to owed)

---

## Shared schema API

**File:** `shared/payment-amount-schema.ts`  
**Tests:** `shared/payment-amount-schema.test.ts`  
**Shims:** `src/lib/payment-amount-schema.ts`, `convex/lib/paymentAmountSchema.ts`

```ts
export type PaymentAddFormInput = {
  amountInput: string
  note?: string
}

export type PaymentAddArgs = {
  amountCents: number
  note?: string
}

export type PaymentAddContext = {
  remainingCents: number
}

export type PaymentAddServerContext = {
  owedCents: number
  paidCents: number
}

export function parsePaymentAmountInput(
  value: string,
): { ok: true; cents: number } | { ok: false; message: string }

export function validatePaymentAddForm(
  input: PaymentAddFormInput,
  context: PaymentAddContext,
):
  | { ok: true; data: { amountCents: number; note?: string } }
  | { ok: false; message: string }

export function validatePaymentAdd(
  args: PaymentAddArgs,
  context: PaymentAddServerContext,
):
  | { ok: true; data: { amountCents: number; note?: string } }
  | { ok: false; message: string }
```

`validatePaymentAddForm` order:

1. `parsePaymentAmountInput` on `amountInput` (required — empty fails)
2. `positiveCentsSchema('Сумата')` on parsed cents
3. `amountCents > context.remainingCents` → cap error
4. `optionalNoteSchema(PAYMENT_NOTE_MAX)` on `note` when provided

`validatePaymentAdd` (server) order:

1. `positiveCentsSchema('Сумата')` on `amountCents`
2. `optionalNoteSchema(PAYMENT_NOTE_MAX)` on `note` when provided
3. `paidCents + amountCents > owedCents` → cap error

---

## Server behavior

### `payments.add`

Replace inline `args.amountCents <= 0` + `assertPositiveIntCents` with schema:

```ts
const validated = validatePaymentAdd(
  { amountCents: args.amountCents, note: args.note },
  { owedCents, paidCents },
)
if (!validated.ok) {
  throw new ConvexError(validated.message)
}

await ctx.db.insert('payments', {
  billId: args.billId,
  participantId: args.participantId,
  amountCents: validated.data.amountCents,
  note: validated.data.note,
  paidAt: Date.now(),
})
```

Keep unchanged before schema call:

- `requireBillOwner`
- Participant exists and `participant.billId === args.billId`
- Bill/items/participants/assignments load for `calculateBillTotals`

Remove `assertPositiveIntCents` import from `payments.ts` (schema covers format).

### `payments.undoLast`

Unchanged — no amount validation.

---

## Client behavior

### `PaymentActions` partial payment

```ts
const [amountError, setAmountError] = useState<string | undefined>()

async function handlePartialPayment() {
  const validated = validatePaymentAddForm(
    { amountInput: partialAmount },
    { remainingCents },
  )
  if (!validated.ok) {
    setAmountError(validated.message)
    return
  }

  setAmountError(undefined)
  setPartialAmount('')
  try {
    await addPayment({
      billId,
      participantId,
      amountCents: validated.data.amountCents,
      note: validated.data.note,
    })
    toast.success(`${label} плати ${formatEur(validated.data.amountCents)}`)
  } catch (error) {
    toast.error(getConvexErrorMessage(error))
  }
}
```

### Inline error

- Error text under partial amount `Input` (`aria-invalid`, `text-xs text-destructive`)
- Clear `amountError` on `onChange` when error present (VAL-2 pattern)

### Submit button disable

Extend disabled condition beyond `!partialAmount.trim()`:

```ts
const partialValidation = validatePaymentAddForm(
  { amountInput: partialAmount },
  { remainingCents },
)
const canSubmitPartial = partialValidation.ok
```

Use `disabled={!canSubmitPartial}` on „Плати“ — prevents submit when amount is invalid, zero, or over remaining. Re-validate on submit anyway for race conditions (balance changed between render and click).

Alternatively: keep `disabled={!partialAmount.trim()}` and validate only on submit (VAL-2 pattern). **Prefer disable when invalid** per roadmap UX — compute `canSubmitPartial` on each render from trimmed input.

### Mark-full button

Unchanged — `handleMarkPaid` sends `remainingCents`; toast on server error only.

---

## Files

| File                                       | Action                                                         |
| ------------------------------------------ | -------------------------------------------------------------- |
| `shared/payment-amount-schema.ts`          | Create                                                         |
| `shared/payment-amount-schema.test.ts`     | Create                                                         |
| `src/lib/payment-amount-schema.ts`         | Create — re-export                                             |
| `convex/lib/paymentAmountSchema.ts`        | Create — re-export                                             |
| `convex/payments.ts`                       | `validatePaymentAdd` in `add`; remove `assertPositiveIntCents` |
| `src/components/bills/payment-actions.tsx` | Inline error; strict parser; disable invalid submit            |

---

## Testing

### Schema tests (`shared/payment-amount-schema.test.ts`)

- `"12,50"` → `1250` cents
- Comma decimal: `"3,99"` → `399`
- Empty / `"abc"` fails
- `"0,00"` fails (non-positive)
- Amount `100` with `remainingCents: 50` fails cap
- Amount `50` with `remainingCents: 50` passes
- Note blank → `undefined`; 201 chars fails
- Server `validatePaymentAdd`: `paidCents + amount > owedCents` fails

### Manual QA

1. Partial pay with empty input → button disabled
2. Partial pay `"abc"` → inline error; no payment
3. Partial pay `"0"` → inline error
4. Partial pay `"12,50"` within remaining → success toast
5. Partial pay amount > remaining → inline error
6. „Платено“ with remaining balance → pays full amount
7. Overpay via devtools mutation → server `Сумата надвишава дължимото.`
8. Undo last payment → unchanged

---

## Exit criteria

- [x] `shared/payment-amount-schema.ts` + tests pass (including comma decimal)
- [x] `payments.add` validates through shared schema
- [x] Partial input shows inline error; no `parseEurInput` on payment path
- [x] Submit disabled when amount invalid or > remaining
- [x] `pnpm run preflight` passes
- [x] Roadmap VAL-4 marked ✅

---

## Next phase

**VAL-5 — Guest flows** (`docs/superpowers/specs/2026-07-09-val-5-guest-flows-design.md`): error message map + `deviceId` cap — light scope, mostly selection not free text.
