import { EUR_CENTS_MAX } from './constants'
import { z } from 'zod'

const INVALID_AMOUNT_MESSAGE = 'Невалидна сума.'

export function parseEurInputStrict(
  value: string,
): { ok: true; cents: number } | { ok: false; message: string } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { ok: false, message: INVALID_AMOUNT_MESSAGE }
  }

  const normalized = trimmed.replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  if (Number.isNaN(parsed) || parsed < 0) {
    return { ok: false, message: INVALID_AMOUNT_MESSAGE }
  }

  const cents = Math.round(parsed * 100)
  if (cents > EUR_CENTS_MAX) {
    return { ok: false, message: INVALID_AMOUNT_MESSAGE }
  }

  return { ok: true, cents }
}

export function eurInputSchema() {
  return z
    .string()
    .superRefine((raw, context) => {
      const result = parseEurInputStrict(raw)
      if (!result.ok) {
        context.addIssue({
          code: 'custom',
          message: result.message,
        })
      }
    })
    .transform((raw) => {
      const result = parseEurInputStrict(raw)
      if (!result.ok) {
        throw new Error('eurInputSchema transform called after failed refine')
      }
      return result.cents
    })
}
