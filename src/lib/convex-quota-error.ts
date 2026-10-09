import { getConvexErrorPayload } from './convex-error.ts'
import {
  isQuotaErrorCode,
  SUBSCRIPTION_MESSAGES,
} from '../../shared/subscription-messages.ts'
import type { QuotaErrorCode } from '../../shared/subscription-messages.ts'

export function parseQuotaError(
  error: unknown,
): { code: QuotaErrorCode; message: string } | null {
  const data = getConvexErrorPayload(error)
  if (!data || typeof data !== 'object') return null

  const code = Reflect.get(data, 'code')
  const message = Reflect.get(data, 'message')
  if (!isQuotaErrorCode(code)) return null
  if (typeof message === 'string' && message.trim()) {
    return { code, message }
  }
  return { code, message: SUBSCRIPTION_MESSAGES[code] }
}
