# VAL-1 — Bill Metadata Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inline validation for restaurant, tip, note, and date on the bill editor; shared schema enforced in `bills.update` and `receiptScan.apply`.

**Architecture:** `shared/bill-metadata-schema.ts` composes VAL-0 field schemas; client validates per-field before debounced save; Convex parses full patch before `db.patch`.

**Tech Stack:** Zod 4, Convex, React, Vitest

**Spec:** `docs/superpowers/specs/2026-07-09-val-1-bill-metadata-design.md`

**Status:** ✅ Complete (2026-07-09)

---

## Task 1: Bill metadata schema (TDD)

**Files:**

- Create: `shared/bill-metadata-schema.ts`
- Create: `shared/bill-metadata-schema.test.ts`

- [x] **Step 1: Write failing tests**

```ts
// shared/bill-metadata-schema.test.ts
import { describe, expect, it } from 'vitest'
import {
  parseBillMetadataPatch,
  parseTipInputToCents,
  validateBillMetadataField,
} from './bill-metadata-schema'
import { RESTAURANT_NAME_MAX } from './validation/constants'

describe('parseTipInputToCents', () => {
  it('returns 0 for empty tip', () => {
    expect(parseTipInputToCents('')).toEqual({ ok: true, cents: 0 })
    expect(parseTipInputToCents('0,00')).toEqual({ ok: true, cents: 0 })
  })

  it('parses valid tip', () => {
    expect(parseTipInputToCents('12,50')).toEqual({ ok: true, cents: 1250 })
  })

  it('rejects invalid tip', () => {
    expect(parseTipInputToCents('abc').ok).toBe(false)
  })
})

describe('parseBillMetadataPatch', () => {
  it('trims restaurant name', () => {
    const result = parseBillMetadataPatch({ restaurantName: '  Механа  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.restaurantName).toBe('Механа')
    }
  })

  it('allows empty restaurant while draft', () => {
    expect(parseBillMetadataPatch({ restaurantName: '' }).success).toBe(true)
  })

  it('rejects restaurant over max', () => {
    expect(
      parseBillMetadataPatch({
        restaurantName: 'x'.repeat(RESTAURANT_NAME_MAX + 1),
      }).success,
    ).toBe(false)
  })

  it('normalizes blank note to undefined', () => {
    const result = parseBillMetadataPatch({ note: '   ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.note).toBeUndefined()
    }
  })

  it('validates only provided keys', () => {
    expect(parseBillMetadataPatch({ tipCents: -1 }).success).toBe(false)
    expect(parseBillMetadataPatch({ date: Date.UTC(1999, 0, 1) }).success).toBe(
      false,
    )
  })
})

describe('validateBillMetadataField', () => {
  it('validates tip input for client save gate', () => {
    expect(validateBillMetadataField('tip', 'abc').ok).toBe(false)
    expect(validateBillMetadataField('tip', '3,00')).toEqual({
      ok: true,
      patch: { tipCents: 300 },
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run shared/bill-metadata-schema.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement schema**

```ts
// shared/bill-metadata-schema.ts
import { z } from 'zod'
import { formatZodFieldErrors, firstZodIssueMessage } from './validation/errors'
import { parseEurInputStrict } from './validation/eur'
import {
  billDateSchema,
  nonNegativeCentsSchema,
  optionalNoteSchema,
  restaurantNameSchema,
} from './validation/fields'

export type BillMetadataField = 'restaurantName' | 'note' | 'tip' | 'date'

export type BillMetadataPatchInput = {
  restaurantName?: string
  note?: string
  tipCents?: number
  date?: number
}

export type BillMetadataPatchData = {
  restaurantName?: string
  note?: string | undefined
  tipCents?: number
  date?: number
}

export function parseTipInputToCents(
  value: string,
): { ok: true; cents: number } | { ok: false; message: string } {
  const trimmed = value.trim()
  if (!trimmed || trimmed === '0' || trimmed === '0,00' || trimmed === '0.00') {
    return { ok: true, cents: 0 }
  }
  return parseEurInputStrict(trimmed)
}

export function parseBillMetadataPatch(patch: BillMetadataPatchInput) {
  const output: BillMetadataPatchData = {}
  const issues: z.ZodIssue[] = []

  if (patch.restaurantName !== undefined) {
    const parsed = restaurantNameSchema().safeParse(patch.restaurantName)
    if (!parsed.success) {
      issues.push(
        ...parsed.error.issues.map((issue) => ({
          ...issue,
          path: ['restaurantName', ...issue.path],
        })),
      )
    } else {
      output.restaurantName = parsed.data
    }
  }

  if (patch.note !== undefined) {
    const parsed = optionalNoteSchema().safeParse(patch.note)
    if (!parsed.success) {
      issues.push(
        ...parsed.error.issues.map((issue) => ({
          ...issue,
          path: ['note', ...issue.path],
        })),
      )
    } else {
      output.note = parsed.data
    }
  }

  if (patch.tipCents !== undefined) {
    const parsed = nonNegativeCentsSchema('Бакшишът').safeParse(patch.tipCents)
    if (!parsed.success) {
      issues.push(
        ...parsed.error.issues.map((issue) => ({
          ...issue,
          path: ['tipCents', ...issue.path],
        })),
      )
    } else {
      output.tipCents = parsed.data
    }
  }

  if (patch.date !== undefined) {
    const parsed = billDateSchema.safeParse(patch.date)
    if (!parsed.success) {
      issues.push(
        ...parsed.error.issues.map((issue) => ({
          ...issue,
          path: ['date', ...issue.path],
        })),
      )
    } else {
      output.date = parsed.data
    }
  }

  if (issues.length > 0) {
    return {
      success: false as const,
      error: new z.ZodError(issues),
    }
  }

  return { success: true as const, data: output }
}

export function formatBillMetadataErrors(error: z.ZodError) {
  const mapped = formatZodFieldErrors(error, [
    'restaurantName',
    'note',
    'tipCents',
    'date',
  ] as const)
  return {
    restaurantName: mapped.restaurantName,
    note: mapped.note,
    tip: mapped.tipCents,
    date: mapped.date,
  }
}

export function validateBillMetadataField(
  field: BillMetadataField,
  value: string,
  options?: { dateMs?: number },
):
  { ok: true; patch: BillMetadataPatchInput } | { ok: false; message: string } {
  switch (field) {
    case 'restaurantName': {
      const result = parseBillMetadataPatch({ restaurantName: value })
      if (!result.success) {
        return {
          ok: false,
          message:
            formatBillMetadataErrors(result.error).restaurantName ??
            'Невалидно име',
        }
      }
      return { ok: true, patch: { restaurantName: result.data.restaurantName } }
    }
    case 'note': {
      const result = parseBillMetadataPatch({ note: value })
      if (!result.success) {
        return {
          ok: false,
          message:
            formatBillMetadataErrors(result.error).note ?? 'Невалидна бележка',
        }
      }
      return { ok: true, patch: { note: result.data.note } }
    }
    case 'tip': {
      const tipResult = parseTipInputToCents(value)
      if (!tipResult.ok) {
        return { ok: false, message: tipResult.message }
      }
      const result = parseBillMetadataPatch({ tipCents: tipResult.cents })
      if (!result.success) {
        return {
          ok: false,
          message:
            formatBillMetadataErrors(result.error).tip ?? 'Невалидна сума',
        }
      }
      return { ok: true, patch: { tipCents: result.data.tipCents } }
    }
    case 'date': {
      const dateMs = options?.dateMs
      if (dateMs === undefined) {
        return { ok: false, message: 'Невалидна дата.' }
      }
      const result = parseBillMetadataPatch({ date: dateMs })
      if (!result.success) {
        return {
          ok: false,
          message:
            formatBillMetadataErrors(result.error).date ?? 'Невалидна дата.',
        }
      }
      return { ok: true, patch: { date: result.data.date } }
    }
  }
}

export { firstZodIssueMessage }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run shared/bill-metadata-schema.test.ts`
Expected: PASS

---

## Task 2: Re-export shims

**Files:**

- Create: `src/lib/bill-metadata-schema.ts`
- Create: `convex/lib/billMetadataSchema.ts`

- [ ] **Step 1: Add client shim**

```ts
// src/lib/bill-metadata-schema.ts
export {
  formatBillMetadataErrors,
  parseBillMetadataPatch,
  parseTipInputToCents,
  validateBillMetadataField,
} from '../../shared/bill-metadata-schema'
export type {
  BillMetadataField,
  BillMetadataPatchData,
  BillMetadataPatchInput,
} from '../../shared/bill-metadata-schema'
```

- [ ] **Step 2: Add Convex shim**

```ts
// convex/lib/billMetadataSchema.ts
export {
  firstZodIssueMessage,
  parseBillMetadataPatch,
} from '../../shared/bill-metadata-schema'
export { restaurantNameSchema } from '../../shared/validation/fields'
export type { BillMetadataPatchData } from '../../shared/bill-metadata-schema'
```

---

## Task 3: Server — `bills.update`

**Files:**

- Modify: `convex/bills.ts`

- [ ] **Step 1: Import parser; remove direct `assertNonNegativeIntCents` for tip**

Add at top:

```ts
import { ConvexError } from 'convex/values'
import {
  firstZodIssueMessage,
  parseBillMetadataPatch,
} from './lib/billMetadataSchema'
```

Remove `assertNonNegativeIntCents` import if no longer used in this file.

- [ ] **Step 2: Validate patch in `update` handler**

Replace the block from arg destructuring through patch build with:

```ts
const bill = await requireBillOwner(ctx, billId)

const rawPatch = {
  ...(restaurantName !== undefined ? { restaurantName } : {}),
  ...(date !== undefined ? { date } : {}),
  ...(note !== undefined ? { note } : {}),
  ...(tipCents !== undefined ? { tipCents } : {}),
}

const parsed = parseBillMetadataPatch(rawPatch)
if (!parsed.success) {
  throw new ConvexError(
    firstZodIssueMessage(parsed.error, 'Невалидни данни за сметката'),
  )
}

const normalized = parsed.data

const oldReceiptStorageId = shouldDeleteReplacedReceiptStorage(
  bill.receiptStorageId,
  receiptStorageId,
)
  ? bill.receiptStorageId
  : undefined

await ctx.db.patch(billId, {
  updatedAt: Date.now(),
  ...(normalized.restaurantName !== undefined
    ? { restaurantName: normalized.restaurantName }
    : {}),
  ...(normalized.date !== undefined ? { date: normalized.date } : {}),
  ...(normalized.note !== undefined ? { note: normalized.note } : {}),
  ...(receiptStorageId !== undefined ? { receiptStorageId } : {}),
  ...(normalized.tipCents !== undefined
    ? { tipCents: normalized.tipCents }
    : {}),
})
```

Note: when `note` is explicitly cleared, patch includes `note: undefined` from client — ensure client sends `note: ''` which normalizes to `undefined` and patch uses `...(normalized.note !== undefined ? { note: normalized.note } : {})`. If normalized note is `undefined` from blank string, we still need to **clear** note in DB. Adjust patch logic:

```ts
if ('note' in normalized) {
  await patch with note: normalized.note // may be undefined to clear
}
```

Use:

```ts
...(note !== undefined ? { note: normalized.note } : {}),
```

where `normalized.note` can be `undefined` to clear the field.

- [ ] **Step 3: Run Convex TypeScript**

Run: `npx convex codegen`
Expected: TypeScript passes

---

## Task 4: Server — `receiptScan.apply`

**Files:**

- Modify: `convex/receiptScan.ts`

- [ ] **Step 1: Validate OCR restaurant name**

```ts
import { ConvexError } from 'convex/values'
import { restaurantNameSchema } from './lib/billMetadataSchema'

// Inside apply handler, replace direct patch:
if (args.updateRestaurantName) {
  const restaurantName = args.restaurantName ?? scan.extractedRestaurantName
  if (restaurantName !== undefined) {
    const parsed = restaurantNameSchema().safeParse(restaurantName)
    if (!parsed.success) {
      throw new ConvexError(
        parsed.error.issues[0]?.message ?? 'Невалидно име на ресторант',
      )
    }
    await ctx.db.patch(scan.billId, { restaurantName: parsed.data })
  }
}
```

---

## Task 5: UI — `BillAdvancedSettings`

**Files:**

- Modify: `src/components/bills/bill-advanced-settings.tsx`

- [ ] **Step 1: Add error props and display**

Extend props:

```ts
noteError?: string
dateError?: string
```

On note `Input`:

```tsx
aria-invalid={Boolean(noteError)}
onChange={(e) => {
  onNoteChange(e.target.value)
}}
```

Add below note input:

```tsx
{
  noteError ? <p className="text-xs text-destructive">{noteError}</p> : null
}
```

Same pattern for date input with `dateError`.

---

## Task 6: UI — Bill editor save gate + inline errors

**Files:**

- Modify: `src/routes/bills/$billId/index.tsx`

- [ ] **Step 1: Add field error state and validated save helper**

```ts
import { validateBillMetadataField } from '#/lib/bill-metadata-schema.ts'

const [fieldErrors, setFieldErrors] = useState<{
  restaurantName?: string
  note?: string
  tip?: string
  date?: string
}>({})

function clearFieldError(field: keyof typeof fieldErrors) {
  setFieldErrors((prev) => {
    if (!prev[field]) return prev
    const next = { ...prev }
    delete next[field]
    return next
  })
}

function scheduleValidatedSave(
  field: 'restaurantName' | 'note' | 'tip' | 'date',
  rawValue: string,
  options?: { dateMs?: number },
) {
  const validated = validateBillMetadataField(field, rawValue, options)
  if (!validated.ok) {
    setFieldErrors((prev) => ({ ...prev, [field]: validated.message }))
    return
  }
  clearFieldError(field)
  scheduleSave(validated.patch)
}
```

- [ ] **Step 2: Wire field onChange handlers**

Restaurant:

```tsx
onChange={(e) => {
  const value = e.target.value
  setRestaurantName(value)
  if (fieldErrors.restaurantName) clearFieldError('restaurantName')
  scheduleValidatedSave('restaurantName', value)
}}
```

Add `aria-invalid` and error paragraph below input.

Tip:

```tsx
onChange={(e) => {
  const value = e.target.value
  setTip(value)
  if (fieldErrors.tip) clearFieldError('tip')
  scheduleValidatedSave('tip', value)
}}
```

Remove direct `parseEurInput` call from tip handler.

Note (in `onNoteChange` callback):

```tsx
onNoteChange={(value) => {
  setNote(value)
  if (fieldErrors.note) clearFieldError('note')
  scheduleValidatedSave('note', value)
}}
```

Date:

```tsx
onDateChange={(value) => {
  setDate(value)
  if (fieldErrors.date) clearFieldError('date')
  scheduleValidatedSave('date', value, { dateMs: fromDateInputValue(value) })
}}
```

- [ ] **Step 3: Pass errors to `BillAdvancedSettings`**

```tsx
<BillAdvancedSettings
  note={note}
  date={date}
  noteError={fieldErrors.note}
  dateError={fieldErrors.date}
  onNoteChange={...}
  onDateChange={...}
/>
```

---

## Task 7: Docs & verification

**Files:**

- Modify: `docs/superpowers/specs/2026-07-09-val-1-bill-metadata-design.md` — Status → Approved
- Modify: `docs/superpowers/specs/2026-07-09-app-validation-roadmap.md` — VAL-1 → ✅ Done

- [ ] **Step 1: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass (including new `bill-metadata-schema.test.ts`)

- [ ] **Step 2: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

- [ ] **Step 3: Manual QA checklist**

1. 81-char restaurant → inline error, no server save
2. Valid restaurant → debounced save works
3. Tip `abc` → error; `5,00` → saves; empty → saves 0
4. Note >500 chars → error in advanced settings
5. OCR apply with invalid restaurant → toast error

---

## Self-review (spec coverage)

| Spec requirement                 | Task                           |
| -------------------------------- | ------------------------------ |
| Shared `bill-metadata-schema.ts` | Task 1                         |
| `bills.update` validation        | Task 3                         |
| `receiptScan.apply` restaurant   | Task 4                         |
| Inline errors all 4 fields       | Tasks 5–6                      |
| Skip debounced save when invalid | Task 6 `scheduleValidatedSave` |
| Tip strict parse (no silent 0)   | Task 1 `parseTipInputToCents`  |
| Tests                            | Task 1, 7                      |

---

**Next after completion:** VAL-2 Participants spec (`val-2-participants-design.md`)
