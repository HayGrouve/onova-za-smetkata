import { describe, expect, it } from 'vitest'
import { GUEST_FLOW_MESSAGES } from './guest-flow-messages'

describe('GUEST_FLOW_MESSAGES', () => {
  it('has non-empty values for all keys', () => {
    for (const value of Object.values(GUEST_FLOW_MESSAGES)) {
      expect(value.trim().length).toBeGreaterThan(0)
    }
  })

  it('preserves prior server literals (regression)', () => {
    expect(GUEST_FLOW_MESSAGES.participantNotOnBill).toBe(
      'Участникът не принадлежи на тази сметка.',
    )
    expect(GUEST_FLOW_MESSAGES.nameTaken).toBe(
      'Това име вече е заето от друг телефон.',
    )
    expect(GUEST_FLOW_MESSAGES.sessionExpired).toBe(
      'Сесията изтече. Изберете името си отново.',
    )
    expect(GUEST_FLOW_MESSAGES.claimRateLimitActor).toBe(
      'Твърде много опити за присъединяване. Опитайте отново след малко.',
    )
  })
})
