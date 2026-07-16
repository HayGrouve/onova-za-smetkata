# VAL-4 — Payments Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate partial payment amounts in `PaymentActions` — inline errors client-side, shared schema enforced in `payments.add`.

**Architecture:** `shared/payment-amount-schema.ts` composes `parseEurInputStrict` + `positiveCentsSchema`; client validates form with `remainingCents` cap; server validates format then owed cap from DB totals.

**Tech Stack:** Zod 4, Convex, React, Vitest

**Spec:** `docs/superpowers/specs/2026-07-09-val-4-payments-design.md`

**Status:** ✅ Complete (2026-07-09)

---

## Task 1: Payment amount schema (TDD)

**Files:**

- Create: `shared/payment-amount-schema.ts`
- Create: `shared/payment-amount-schema.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// shared/payment-amount-schema.test.ts
import { describe, expect, it } from 'vitest'
import {
  parsePaymentAmountInput,
  validatePaymentAdd,
  validatePaymentAddForm,
} from './payment-amount-schema'
import { PAYMENT_NOTE_MAX } from './validation/constants'

const OVER_CAP_MESSAGE = 'Сумата надвишава дължимото.'

describe('parsePaymentAmountInput', () => {
  it('parses comma decimal', () => {
    expect(parsePaymentAmountInput('12,50')).toEqual({ ok: true, cents: 1250 })
    expect(parsePaymentAmountInput('3,99')).toEqual({ ok: true, cents: 399 })
  })

  it('rejects empty and invalid', () => {
    expect(parsePaymentAmountInput('').ok).toBe(false)
    expect(parsePaymentAmountInput('abc').ok).toBe(false)
  })
})

describe('validatePaymentAddForm', () => {
  it('accepts valid partial within remaining', () => {
    const result = validatePaymentAddForm(
      { amountInput: '12,50' },
      { remainingCents: 2000 },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.amountCents).toBe(1250)
    }
  })

  it('rejects zero amount', () => {
    const result = validatePaymentAddForm(
      { amountInput: '0,00' },
      { remainingCents: 2000 },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe('Сумата трябва да е положителна.')
    }
  })

  it('rejects amount over remaining', () => {
    const result = validatePaymentAddForm(
      { amountInput: '10,00' },
      { remainingCents: 500 },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe(OVER_CAP_MESSAGE)
    }
  })

  it('allows exact remaining', () => {
    const result = validatePaymentAddForm(
      { amountInput: '5,00' },
      { remainingCents: 500 },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects overlong note', () => {
    const result = validatePaymentAddForm(
      { amountInput: '1,00', note: 'x'.repeat(PAYMENT_NOTE_MAX + 1) },
      { remainingCents: 500 },
    )
    expect(result.ok).toBe(false)
  })
})

describe('validatePaymentAdd', () => {
  it('accepts valid server args', () => {
    const result = validatePaymentAdd(
      { amountCents: 500 },
      { owedCents: 1000, paidCents: 0 },
    )
    expect(result.ok).toBe(true)
  })

  it('rejects non-positive amount', () => {
    expect(
      validatePaymentAdd({ amountCents: 0 }, { owedCents: 1000, paidCents: 0 })
        .ok,
    ).toBe(false)
  })

  it('rejects overpay', () => {
    const result = validatePaymentAdd(
      { amountCents: 600 },
      { owedCents: 1000, paidCents: 500 },
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toBe(OVER_CAP_MESSAGE)
    }
  })

  it('allows paying exactly to owed', () => {
    const result = validatePaymentAdd(
      { amountCents: 500 },
      { owedCents: 1000, paidCents: 500 },
    )
    expect(result.ok).toBe(true)
  })

  it('normalizes blank note to undefined', () => {
    const result = validatePaymentAdd(
      { amountCents: 100, note: '   ' },
      { owedCents: 1000, paidCents: 0 },
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.note).toBeUndefined()
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run shared/payment-amount-schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schema**

```ts
// shared/payment-amount-schema.ts
import { PAYMENT_NOTE_MAX } from './validation/constants'
import { parseEurInputStrict } from './validation/eur'
import { optionalNoteSchema, positiveCentsSchema } from './validation/fields'

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

export type PaymentAddData = {
  amountCents: number
  note?: string
}

const OVER_CAP_MESSAGE = 'Сумата надвишава дължимото.'
const paymentNoteSchema = () => optionalNoteSchema(PAYMENT_NOTE_MAX)

export function parsePaymentAmountInput(
  value: string,
): { ok: true; cents: number } | { ok: false; message: string } {
  return parseEurInputStrict(value)
}

function validatePaymentAmountCents(
  amountCents: number,
): { ok: true; amountCents: number } | { ok: false; message: string } {
  const parsed = positiveCentsSchema('Сумата').safeParse(amountCents)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Невалидна сума.',
    }
  }
  return { ok: true, amountCents: parsed.data }
}

function validatePaymentNote(
  note: string | undefined,
): { ok: true; note?: string } | { ok: false; message: string } {
  if (note === undefined) {
    return { ok: true }
  }
  const parsed = paymentNoteSchema().safeParse(note)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Невалидна бележка',
    }
  }
  return { ok: true, note: parsed.data }
}

export function validatePaymentAddForm(
  input: PaymentAddFormInput,
  context: PaymentAddContext,
): { ok: true; data: PaymentAddData } | { ok: false; message: string } {
  const parsedAmount = parsePaymentAmountInput(input.amountInput)
  if (!parsedAmount.ok) {
    return { ok: false, message: parsedAmount.message }
  }

  const validatedAmount = validatePaymentAmountCents(parsedAmount.cents)
  if (!validatedAmount.ok) {
    return { ok: false, message: validatedAmount.message }
  }

  if (validatedAmount.amountCents > context.remainingCents) {
    return { ok: false, message: OVER_CAP_MESSAGE }
  }

  const validatedNote = validatePaymentNote(input.note)
  if (!validatedNote.ok) {
    return { ok: false, message: validatedNote.message }
  }

  return {
    ok: true,
    data: {
      amountCents: validatedAmount.amountCents,
      ...(validatedNote.note !== undefined ? { note: validatedNote.note } : {}),
    },
  }
}

export function validatePaymentAdd(
  args: PaymentAddArgs,
  context: PaymentAddServerContext,
): { ok: true; data: PaymentAddData } | { ok: false; message: string } {
  const validatedAmount = validatePaymentAmountCents(args.amountCents)
  if (!validatedAmount.ok) {
    return { ok: false, message: validatedAmount.message }
  }

  const validatedNote = validatePaymentNote(args.note)
  if (!validatedNote.ok) {
    return { ok: false, message: validatedNote.message }
  }

  if (context.paidCents + validatedAmount.amountCents > context.owedCents) {
    return { ok: false, message: OVER_CAP_MESSAGE }
  }

  return {
    ok: true,
    data: {
      amountCents: validatedAmount.amountCents,
      ...(validatedNote.note !== undefined ? { note: validatedNote.note } : {}),
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run shared/payment-amount-schema.test.ts`
Expected: PASS

---

## Task 2: Re-export shims

**Files:**

- Create: `src/lib/payment-amount-schema.ts`
- Create: `convex/lib/paymentAmountSchema.ts`

- [ ] **Step 1: Client shim**

```ts
// src/lib/payment-amount-schema.ts
export {
  parsePaymentAmountInput,
  validatePaymentAdd,
  validatePaymentAddForm,
} from '../../shared/payment-amount-schema'
export type {
  PaymentAddArgs,
  PaymentAddContext,
  PaymentAddData,
  PaymentAddFormInput,
  PaymentAddServerContext,
} from '../../shared/payment-amount-schema'
```

- [ ] **Step 2: Convex shim**

```ts
// convex/lib/paymentAmountSchema.ts
export { validatePaymentAdd } from '../../shared/payment-amount-schema'
export type {
  PaymentAddArgs,
  PaymentAddData,
  PaymentAddServerContext,
} from '../../shared/payment-amount-schema'
```

---

## Task 3: Server — `payments.add`

**Files:**

- Modify: `convex/payments.ts`

- [ ] **Step 1: Replace amount validation with schema**

Remove import: `assertPositiveIntCents` from `./lib/money`  
Add import: `validatePaymentAdd` from `./lib/paymentAmountSchema`

Remove lines:

```ts
if (args.amountCents <= 0) {
  throw new ConvexError('Сумата трябва да е положителна.')
}
assertPositiveIntCents(args.amountCents)
```

Replace cap block + insert with:

```ts
const validated = validatePaymentAdd(
  { amountCents: args.amountCents, note: args.note },
  { owedCents, paidCents },
)
if (!validated.ok) {
  throw new ConvexError(validated.message)
}

const id = await ctx.db.insert('payments', {
  billId: args.billId,
  participantId: args.participantId,
  amountCents: validated.data.amountCents,
  note: validated.data.note,
  paidAt: Date.now(),
})
```

Keep participant-on-bill check and `calculateBillTotals` load **before** `validatePaymentAdd`.

- [ ] **Step 2: Run Convex TypeScript**

Run: `npx convex codegen`
Expected: TypeScript passes

---

## Task 4: UI — `PaymentActions`

**Files:**

- Modify: `src/components/bills/payment-actions.tsx`

- [ ] **Step 1: Add imports and state**

```ts
import { validatePaymentAddForm } from '#/lib/payment-amount-schema.ts'

const [amountError, setAmountError] = useState<string | undefined>()
```

Remove `parseEurInput` import (keep `formatEur`).

- [ ] **Step 2: Compute `canSubmitPartial`**

After `remainingCents`:

```ts
const partialValidation = validatePaymentAddForm(
  { amountInput: partialAmount },
  { remainingCents },
)
const canSubmitPartial = partialValidation.ok
```

- [ ] **Step 3: Update `handlePartialPayment`**

```ts
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

- [ ] **Step 4: Wire inline error and disabled submit**

Wrap partial input in `flex flex-col gap-1 min-w-0 flex-1`:

```tsx
;<Input
  value={partialAmount}
  onChange={(e) => {
    setPartialAmount(e.target.value)
    if (amountError) setAmountError(undefined)
  }}
  inputMode="decimal"
  placeholder="Частична сума"
  className="h-11 min-w-0 flex-1"
  aria-invalid={Boolean(amountError)}
/>
{
  amountError ? <p className="text-xs text-destructive">{amountError}</p> : null
}
```

Submit button:

```tsx
<Button
  variant="outline"
  className="h-11 shrink-0"
  onClick={handlePartialPayment}
  disabled={!canSubmitPartial}
>
```

- [ ] **Step 5: Leave mark-full and undo unchanged**

`handleMarkPaid` still sends `remainingCents` directly — no EUR parsing.

---

## Task 5: Docs & verification

**Files:**

- Modify: `docs/superpowers/specs/2026-07-09-val-4-payments-design.md` — Status → Approved
- Modify: `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md` — VAL-4 → ✅ Done

- [ ] **Step 1: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass

- [ ] **Step 2: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

- [ ] **Step 3: Manual QA**

1. Empty partial input → „Плати“ disabled
2. `"abc"` → disabled; click if forced → inline error
3. `"0"` → disabled
4. `"12,50"` within remaining → success
5. Amount > remaining → disabled + error on submit attempt
6. „Платено“ → pays full remaining
7. Undo last → unchanged

- [ ] **Step 4: Update plan status**

Mark this plan **Status:** ✅ Complete

---

## Self-review (spec coverage)

| Spec requirement                   | Task          |
| ---------------------------------- | ------------- |
| `shared/payment-amount-schema.ts`  | Task 1        |
| Comma decimal tests                | Task 1        |
| Cap client + server                | Tasks 1, 3, 4 |
| Note server validation             | Task 1, 3     |
| `payments.add` schema              | Task 3        |
| Remove `assertPositiveIntCents`    | Task 3        |
| Inline error in `PaymentActions`   | Task 4        |
| Disable invalid submit             | Task 4        |
| No `parseEurInput` on payment path | Task 4        |
| Mark-full unchanged                | Task 4        |

---

**Next after completion:** VAL-5 Guest flows spec (`val-5-guest-flows-design.md`)
