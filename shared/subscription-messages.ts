import { HOST_PRO_PLANS } from './host-pro-plans'

const MONTHLY_PRICE = HOST_PRO_PLANS.month.price

export const QUOTA_ERROR_CODES = [
  'QUOTA_BILLS',
  'QUOTA_OCR',
  'QUOTA_GROUPS',
] as const

export type QuotaErrorCode = (typeof QUOTA_ERROR_CODES)[number]

export const SUBSCRIPTION_MESSAGES: Record<QuotaErrorCode, string> = {
  QUOTA_BILLS: `Стигна лимита от 5 сметки за този месец. Надгради до Pro за ${MONTHLY_PRICE}/мес.`,
  QUOTA_OCR: `Стигна лимита от 5 сканирания за този месец. Надгради до Pro за ${MONTHLY_PRICE}/мес.`,
  QUOTA_GROUPS: `Безплатният план позволява 1 група. Надгради до Pro за ${MONTHLY_PRICE}/мес.`,
}

export function isQuotaErrorCode(value: unknown): value is QuotaErrorCode {
  return (
    typeof value === 'string' &&
    (QUOTA_ERROR_CODES as readonly string[]).includes(value)
  )
}
