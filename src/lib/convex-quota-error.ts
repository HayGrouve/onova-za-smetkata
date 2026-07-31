import {
  isQuotaErrorCode,
  SUBSCRIPTION_MESSAGES,
} from '../../shared/subscription-messages.ts'
import type { QuotaErrorCode } from '../../shared/subscription-messages.ts'

export function getConvexErrorData(error: unknown): unknown {
  if (error && typeof error === 'object' && 'data' in error) {
    return Reflect.get(error, 'data')
  }
  return undefined
}

export function parseQuotaError(
  error: unknown,
): { code: QuotaErrorCode; message: string } | null {
  const data = getConvexErrorData(error)
  if (!data || typeof data !== 'object') return null

  const code = Reflect.get(data, 'code')
  const message = Reflect.get(data, 'message')
  if (!isQuotaErrorCode(code)) return null
  if (typeof message === 'string' && message.trim()) {
    return { code, message }
  }
  return { code, message: SUBSCRIPTION_MESSAGES[code] }
}

export function isQuotaError(error: unknown): boolean {
  return parseQuotaError(error) !== null
}
