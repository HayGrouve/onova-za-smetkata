import { z } from 'zod'
import { PAYMENT_NOTE_MAX } from './validation/constants'
import { firstZodIssueMessage, formatZodFieldErrors } from './validation/errors'
import { parseEurInputStrict } from './validation/eur'
import {
  itemNameSchema,
  nonNegativeCentsSchema,
  optionalNoteSchema,
  quantityInputSchema,
} from './validation/fields'

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

export type ItemAddData = {
  name: string
  unitPriceCents: number
  quantity: number
  note?: string
}

export type ItemUpdatePatchData = Partial<ItemAddData>

const itemNoteSchema = () => optionalNoteSchema(PAYMENT_NOTE_MAX)

export function parseItemPriceInput(
  value: string,
): { ok: true; cents: number } | { ok: false; message: string } {
  return parseEurInputStrict(value)
}

function prefixIssues(issues: z.ZodIssue[], field: string): z.ZodIssue[] {
  return issues.map((issue) => ({
    ...issue,
    path: [field, ...issue.path],
  }))
}

export function formatItemFieldErrors(
  error: z.ZodError,
): Partial<Record<ItemField, string>> {
  return formatZodFieldErrors(error, [
    'name',
    'price',
    'quantity',
    'note',
  ] as const)
}

export function validateItemNameInput(value: string): string | undefined {
  const parsed = itemNameSchema.safeParse(value)
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Невалидно наименование'
  }
  return undefined
}

export function validateItemPriceInput(value: string): string | undefined {
  const result = parseItemPriceInput(value)
  if (!result.ok) return result.message
  return undefined
}

export function validateItemQuantityInput(value: string): string | undefined {
  const parsed = quantityInputSchema.safeParse(value)
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? 'Невалидно количество'
  }
  return undefined
}

export function validateItemAddForm(
  input: ItemAddFormInput,
):
  | { ok: true; data: ItemAddData }
  | { ok: false; fieldErrors: Partial<Record<ItemField, string>> } {
  const fieldErrors: Partial<Record<ItemField, string>> = {}

  const nameParsed = itemNameSchema.safeParse(input.name)
  if (!nameParsed.success) {
    fieldErrors.name = nameParsed.error.issues[0]?.message
  }

  const priceResult = parseItemPriceInput(input.priceInput)
  if (!priceResult.ok) {
    fieldErrors.price = priceResult.message
  }

  const quantityParsed = quantityInputSchema.safeParse(input.quantityInput)
  if (!quantityParsed.success) {
    fieldErrors.quantity = quantityParsed.error.issues[0]?.message
  }

  let note: string | undefined
  if (input.note !== undefined) {
    const noteParsed = itemNoteSchema().safeParse(input.note)
    if (!noteParsed.success) {
      fieldErrors.note = noteParsed.error.issues[0]?.message
    } else {
      note = noteParsed.data
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors }
  }

  if (!nameParsed.success || !priceResult.ok || !quantityParsed.success) {
    return { ok: false, fieldErrors }
  }

  return {
    ok: true,
    data: {
      name: nameParsed.data,
      unitPriceCents: priceResult.cents,
      quantity: quantityParsed.data,
      ...(note !== undefined ? { note } : {}),
    },
  }
}

export function validateItemAddArgs(
  args: ItemAddArgs,
):
  | { ok: true; data: ItemAddData }
  | { ok: false; message: string } {
  const issues: z.ZodIssue[] = []
  const output: ItemAddData = {
    name: '',
    unitPriceCents: 0,
    quantity: 1,
  }

  const nameParsed = itemNameSchema.safeParse(args.name)
  if (!nameParsed.success) {
    issues.push(...prefixIssues(nameParsed.error.issues, 'name'))
  } else {
    output.name = nameParsed.data
  }

  const priceParsed = nonNegativeCentsSchema('Цената').safeParse(
    args.unitPriceCents,
  )
  if (!priceParsed.success) {
    issues.push(...prefixIssues(priceParsed.error.issues, 'price'))
  } else {
    output.unitPriceCents = priceParsed.data
  }

  const quantityParsed = quantityInputSchema.safeParse(args.quantity ?? 1)
  if (!quantityParsed.success) {
    issues.push(...prefixIssues(quantityParsed.error.issues, 'quantity'))
  } else {
    output.quantity = quantityParsed.data
  }

  if (args.note !== undefined) {
    const noteParsed = itemNoteSchema().safeParse(args.note)
    if (!noteParsed.success) {
      issues.push(...prefixIssues(noteParsed.error.issues, 'note'))
    } else {
      output.note = noteParsed.data
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      message: firstZodIssueMessage(new z.ZodError(issues), 'Невалиден артикул'),
    }
  }

  return { ok: true, data: output }
}

export function validateItemUpdatePatch(
  patch: ItemUpdatePatchInput,
):
  | { ok: true; data: ItemUpdatePatchData }
  | { ok: false; message: string } {
  const output: ItemUpdatePatchData = {}
  const issues: z.ZodIssue[] = []

  if (patch.name !== undefined) {
    const parsed = itemNameSchema.safeParse(patch.name)
    if (!parsed.success) {
      issues.push(...prefixIssues(parsed.error.issues, 'name'))
    } else {
      output.name = parsed.data
    }
  }

  if (patch.unitPriceCents !== undefined) {
    const parsed = nonNegativeCentsSchema('Цената').safeParse(
      patch.unitPriceCents,
    )
    if (!parsed.success) {
      issues.push(...prefixIssues(parsed.error.issues, 'price'))
    } else {
      output.unitPriceCents = parsed.data
    }
  }

  if (patch.quantity !== undefined) {
    const parsed = quantityInputSchema.safeParse(patch.quantity)
    if (!parsed.success) {
      issues.push(...prefixIssues(parsed.error.issues, 'quantity'))
    } else {
      output.quantity = parsed.data
    }
  }

  if (patch.note !== undefined) {
    const parsed = itemNoteSchema().safeParse(patch.note)
    if (!parsed.success) {
      issues.push(...prefixIssues(parsed.error.issues, 'note'))
    } else {
      output.note = parsed.data
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      message: firstZodIssueMessage(new z.ZodError(issues), 'Невалиден артикул'),
    }
  }

  return { ok: true, data: output }
}

export { firstZodIssueMessage } from './validation/errors'
