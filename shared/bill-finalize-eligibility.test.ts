import { describe, expect, it } from 'vitest'
import { toBillCalculationSnapshot } from './bill-calculation-snapshot'
import { getBillFinalizeEligibility } from './bill-finalize-eligibility'

describe('getBillFinalizeEligibility', () => {
  it('treats unpaid guests separately from other validation errors', () => {
    const snapshot = toBillCalculationSnapshot(
      {
        participants: [
          { _id: 'host', sortOrder: 0 },
          { _id: 'guest', sortOrder: 1 },
        ],
        items: [
          { _id: 'i1', name: 'Салата', unitPriceCents: 500, quantity: 1 },
        ],
        assignments: [{ itemId: 'i1', participantId: 'guest', unitIndex: 0 }],
        payments: [],
      },
      { hostParticipantId: 'host' },
    )

    const result = getBillFinalizeEligibility({
      restaurantName: 'Механа',
      snapshot,
      participants: [{ _id: 'host' }, { _id: 'guest' }],
      hostParticipantId: 'host',
    })

    expect(result.finalizeValidationPasses).toBe(true)
    expect(result.unpaidCount).toBe(1)
    expect(result.validationErrors).toEqual([])
  })

  it('reports validation failures without unpaid guest count', () => {
    const snapshot = toBillCalculationSnapshot(
      {
        participants: [{ _id: 'host', sortOrder: 0 }],
        items: [],
        assignments: [],
        payments: [],
      },
      { hostParticipantId: 'host' },
    )

    const result = getBillFinalizeEligibility({
      restaurantName: '',
      snapshot,
      participants: [{ _id: 'host' }],
      hostParticipantId: 'host',
    })

    expect(result.finalizeValidationPasses).toBe(false)
    expect(result.unpaidCount).toBe(0)
    expect(
      result.validationErrors.some((e) => e.code === 'missing_restaurant'),
    ).toBe(true)
  })
})
