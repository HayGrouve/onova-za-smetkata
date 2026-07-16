import { describe, expect, it } from 'vitest'

describe('getForGuest contract', () => {
  it('exposes myPayments instead of payments', () => {
    const allowedKeys = [
      'bill',
      'hostParticipantId',
      'participants',
      'items',
      'assignments',
      'myPayments',
      'participantBalances',
    ]
    expect(allowedKeys).not.toContain('payments')
    expect(allowedKeys).toContain('myPayments')
  })
})
