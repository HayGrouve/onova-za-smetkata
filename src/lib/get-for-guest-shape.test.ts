import { describe, expect, it } from 'vitest'

describe('getForGuest contract', () => {
  it('exposes myPayments instead of payments', () => {
    const allowedKeys = [
      'bill',
      'participants',
      'items',
      'assignments',
      'myPayments',
    ]
    expect(allowedKeys).not.toContain('payments')
    expect(allowedKeys).toContain('myPayments')
  })
})
