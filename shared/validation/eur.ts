import { EUR_CENTS_MAX } from './constants'

const INVALID_AMOUNT_MESSAGE = 'Невалидна сума.'

/**
 * Whole euros (optionally grouped by spaces in threes: `1 234`), then an
 * optional `,` or `.` with up to two cent digits — or cents alone (`,50`).
 * Anything else is refused rather than read in part: `12 345,67` must never
 * become 12,00 €.
 */
const EUR_INPUT_PATTERN =
  /^(\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)?(?:[.,](\d{0,2}))?$/

/** Cents as an amount field shows them: `1250` → `12,50`, no symbol. */
export function formatEurInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function parseEurInputStrict(
  value: string,
): { ok: true; cents: number } | { ok: false; message: string } {
  const trimmed = value.trim()
  const match = EUR_INPUT_PATTERN.exec(trimmed)
  if (!match || !/\d/.test(trimmed)) {
    return { ok: false, message: INVALID_AMOUNT_MESSAGE }
  }

  const euros = Number((match.at(1) ?? '').replace(/[ \u00a0\u202f]/g, ''))
  const cents = euros * 100 + Number((match.at(2) ?? '').padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents > EUR_CENTS_MAX) {
    return { ok: false, message: INVALID_AMOUNT_MESSAGE }
  }

  return { ok: true, cents }
}
