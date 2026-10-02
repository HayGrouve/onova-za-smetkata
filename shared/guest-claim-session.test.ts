import { describe, expect, it } from 'vitest'
import { buildGuestClaimSessionState } from './guest-claim-session'

const participantA = 'p-a'
const participantB = 'p-b'

const participants = [
  { id: participantA, sortOrder: 0 },
  { id: participantB, sortOrder: 1 },
]

const items = [
  {
    id: 'beer-1',
    name: 'Бира',
    quantity: 1,
    sortOrder: 0,
    unitPriceCents: 300,
  },
  { id: 'pizza', name: 'Пица', quantity: 3, sortOrder: 1, unitPriceCents: 900 },
  {
    id: 'salad',
    name: 'Салата',
    quantity: 1,
    sortOrder: 2,
    unitPriceCents: 500,
  },
  {
    id: 'beer-2',
    name: 'бира',
    quantity: 1,
    sortOrder: 3,
    unitPriceCents: 300,
  },
]

const assignments = [
  { itemId: 'salad', participantId: participantA, unitIndex: 0 },
  { itemId: 'pizza', participantId: participantA, unitIndex: 0 },
  { itemId: 'pizza', participantId: participantB, unitIndex: 1 },
  { itemId: 'beer-1', participantId: participantB, unitIndex: 0 },
]

function build(
  overrides: Partial<Parameters<typeof buildGuestClaimSessionState>[0]> = {},
) {
  return buildGuestClaimSessionState({
    items,
    assignments,
    participants,
    seatId: participantA,
    ...overrides,
  })
}

describe('buildGuestClaimSessionState', () => {
  it('reports table progress in Units', () => {
    expect(build().tableProgress).toEqual({
      claimedUnits: 4,
      totalUnits: 6,
      freeUnits: 2,
    })
  })

  it('builds a share for each of the phone’s seats', () => {
    const session = build({
      mySeatIds: [participantA, participantB],
      billRelations: {
        participants: [
          { _id: participantA, sortOrder: 0 },
          { _id: participantB, sortOrder: 1 },
        ],
        items: items.map((item) => ({ ...item, _id: item.id })),
        assignments,
        payments: [],
      },
    })
    expect(session.seatShares.map((share) => share.seatId)).toEqual([
      participantA,
      participantB,
    ])
    expect(session.seatShares[0].totals.owedCents).toBe(1400)
    expect(session.seatShares[1].totals.owedCents).toBe(1200)
  })
})
