import { z } from 'zod'
import { formatZodFieldErrors } from './validation/errors'
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

function prefixIssues(issues: z.ZodIssue[], field: string): z.ZodIssue[] {
  return issues.map((issue) => ({
    ...issue,
    path: [field, ...issue.path],
  }))
}

export function parseBillMetadataPatch(patch: BillMetadataPatchInput) {
  const output: BillMetadataPatchData = {}
  const issues: z.ZodIssue[] = []

  if (patch.restaurantName !== undefined) {
    const parsed = restaurantNameSchema().safeParse(patch.restaurantName)
    if (!parsed.success) {
      issues.push(...prefixIssues(parsed.error.issues, 'restaurantName'))
    } else {
      output.restaurantName = parsed.data
    }
  }

  if (patch.note !== undefined) {
    const parsed = optionalNoteSchema().safeParse(patch.note)
    if (!parsed.success) {
      issues.push(...prefixIssues(parsed.error.issues, 'note'))
    } else {
      output.note = parsed.data
    }
  }

  if (patch.tipCents !== undefined) {
    const parsed = nonNegativeCentsSchema('Бакшишът').safeParse(patch.tipCents)
    if (!parsed.success) {
      issues.push(...prefixIssues(parsed.error.issues, 'tipCents'))
    } else {
      output.tipCents = parsed.data
    }
  }

  if (patch.date !== undefined) {
    const parsed = billDateSchema.safeParse(patch.date)
    if (!parsed.success) {
      issues.push(...prefixIssues(parsed.error.issues, 'date'))
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
  | { ok: true; patch: BillMetadataPatchInput }
  | { ok: false; message: string } {
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
      return { ok: true, patch: { restaurantName: value } }
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
      return { ok: true, patch: { note: value } }
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
      return { ok: true, patch: { tipCents: tipResult.cents } }
    }
    case 'date': {
      const dateMs = options?.dateMs
      if (dateMs === undefined || Number.isNaN(dateMs)) {
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
      return { ok: true, patch: { date: dateMs } }
    }
  }
}

export { firstZodIssueMessage } from './validation/errors'
