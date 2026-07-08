import { describe, expect, it } from 'vitest'
import { clampParticipantUnits } from '../../convex/lib/clampParticipantUnits'

describe('clampParticipantUnits', () => {
  it('caps units when others already claimed the pool', () => {
    expect(
      clampParticipantUnits({
        itemQuantity: 2,
        requestedUnits: 2,
        participantId: 'ivan',
        existingAssignments: [
          { participantId: 'maria', units: 2 },
          { participantId: 'ivan', units: 0 },
        ],
      }),
    ).toBe(0)

    expect(
      clampParticipantUnits({
        itemQuantity: 3,
        requestedUnits: 3,
        participantId: 'ivan',
        existingAssignments: [{ participantId: 'maria', units: 2 }],
      }),
    ).toBe(1)
  })

  it('allows full quantity when alone on the item', () => {
    expect(
      clampParticipantUnits({
        itemQuantity: 2,
        requestedUnits: 2,
        participantId: 'ivan',
        existingAssignments: [],
      }),
    ).toBe(2)
  })
})
