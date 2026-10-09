import { describe, expect, it } from 'vitest'
import { SUBSCRIPTION_MESSAGES } from '../../shared/subscription-messages.ts'
import { parseQuotaError } from './convex-quota-error.ts'

describe('parseQuotaError', () => {
  it('reads the code and message a quota ConvexError carries', () => {
    expect(
      parseQuotaError({ data: { code: 'QUOTA_BILLS', message: 'Стига.' } }),
    ).toEqual({ code: 'QUOTA_BILLS', message: 'Стига.' })
  })

  it('falls back to the standard message when the data carries none', () => {
    expect(parseQuotaError({ data: { code: 'QUOTA_OCR' } })).toEqual({
      code: 'QUOTA_OCR',
      message: SUBSCRIPTION_MESSAGES.QUOTA_OCR,
    })
  })

  it('ignores every other error', () => {
    expect(parseQuotaError(new Error('boom'))).toBeNull()
    expect(parseQuotaError({ data: 'Грешка' })).toBeNull()
    expect(parseQuotaError({ data: { code: 'NOPE' } })).toBeNull()
  })
})
