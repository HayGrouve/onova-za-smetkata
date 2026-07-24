import { describe, expect, it } from 'vitest'
import { toBillCalculationSnapshot } from './bill-calculation-snapshot'

describe('toBillCalculationSnapshot', () => {
  const relations = {
    participants: [
      { _id: 'p1', sortOrder: 0 },
      { _id: 'p2', sortOrder: 1 },
    ],
    items: [
      {
        _id: 'i1',
        name: 'Salad',
        unitPriceCents: 500,
        quantity: 2,
      },
    ],
    assignments: [
      { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
      { itemId: 'i1', participantId: 'p2', unitIndex: 1 },
    ],
    payments: [{ participantId: 'p1', amountCents: 250 }],
  }

  it('maps loaded relations to calculation and breakdown inputs', () => {
    const snapshot = toBillCalculationSnapshot(relations, {
      tipCents: 100,
      hostParticipantId: 'p1',
    })

    expect(snapshot.calculationInput).toEqual({
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
      ],
      items: [{ id: 'i1', unitPriceCents: 500, quantity: 2 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p2', unitIndex: 1 },
      ],
      payments: [{ participantId: 'p1', amountCents: 250 }],
      tipCents: 100,
      hostParticipantId: 'p1',
    })
    expect(snapshot.breakdownInput).toEqual({
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
      ],
      items: [
        {
          id: 'i1',
          name: 'Salad',
          unitPriceCents: 500,
          quantity: 2,
        },
      ],
      assignments: [
        { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
        { itemId: 'i1', participantId: 'p2', unitIndex: 1 },
      ],
      tipCents: 100,
    })
  })

  it('defaults tip to zero and omits host when not provided', () => {
    const snapshot = toBillCalculationSnapshot(relations, {})

    expect(snapshot.calculationInput.tipCents).toBe(0)
    expect(snapshot.calculationInput.hostParticipantId).toBeUndefined()
  })
})
