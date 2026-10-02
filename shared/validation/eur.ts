import { EUR_CENTS_MAX } from './constants'

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
