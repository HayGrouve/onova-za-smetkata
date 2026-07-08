import { describe, expect, it } from 'vitest'
import { getPaymentRowBorderClass } from './payment-row-styles'

describe('getPaymentRowBorderClass', () => {
  it('returns red left border for unpaid', () => {
    expect(getPaymentRowBorderClass('unpaid')).toBe('border-l-4 border-red-500')
  })

  it('returns amber left border for partial', () => {
    expect(getPaymentRowBorderClass('partial')).toBe(
      'border-l-4 border-amber-500',
    )
  })

  it('returns empty string for paid', () => {
    expect(getPaymentRowBorderClass('paid')).toBe('')
  })
})
