import { describe, expect, it } from 'vitest'
import {
  isQuotaErrorCode,
  SUBSCRIPTION_MESSAGES,
} from './subscription-messages'

describe('subscription-messages', () => {
  it('defines Bulgarian copy for each quota code', () => {
    expect(SUBSCRIPTION_MESSAGES.QUOTA_BILLS).toContain('5 сметки')
    expect(SUBSCRIPTION_MESSAGES.QUOTA_OCR).toContain('5 сканирания')
    expect(SUBSCRIPTION_MESSAGES.QUOTA_GROUPS).toContain('1 група')
    expect(SUBSCRIPTION_MESSAGES.QUOTA_BILLS).toContain('€2.99')
  })

  it('narrows quota error codes', () => {
    expect(isQuotaErrorCode('QUOTA_BILLS')).toBe(true)
    expect(isQuotaErrorCode('OTHER')).toBe(false)
  })
})
