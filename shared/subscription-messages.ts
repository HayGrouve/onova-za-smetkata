export const QUOTA_ERROR_CODES = [
  'QUOTA_BILLS',
  'QUOTA_OCR',
  'QUOTA_GROUPS',
] as const

export type QuotaErrorCode = (typeof QUOTA_ERROR_CODES)[number]

export const SUBSCRIPTION_MESSAGES: Record<QuotaErrorCode, string> = {
  QUOTA_BILLS:
    'Достигнахте лимита от 5 сметки за този месец. Надградете до Pro за €2.99/мес.',
  QUOTA_OCR:
    'Достигнахте лимита от 5 сканирания за този месец. Надградете до Pro за €2.99/мес.',
  QUOTA_GROUPS:
    'Безплатният план позволява 1 група. Надградете до Pro за €2.99/мес.',
}

export function isQuotaErrorCode(value: unknown): value is QuotaErrorCode {
  return (
    typeof value === 'string' &&
    (QUOTA_ERROR_CODES as readonly string[]).includes(value)
  )
}
