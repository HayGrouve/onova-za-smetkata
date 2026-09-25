import { describe, expect, it } from 'vitest'
import {
  buildGuestClaimSessionState,
  GUEST_CLAIM_EMPTY_MESSAGES,
  resolveGuestClaimEmptyMessage,
} from './guest-claim-session'

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
    activeTab: 'all',
    search: '',
    ...overrides,
  })
}

describe('buildGuestClaimSessionState', () => {
  it('shows identical lines as one Claim group', () => {
    const session = build()
    expect(session.visibleGroups.map((entry) => entry.group.itemIds)).toEqual([
      ['beer-1', 'beer-2'],
      ['pizza'],
      ['salad'],
    ])
  })

  it('counts tabs over Claim groups', () => {
    expect(build().tabCounts).toEqual({ all: 3, free: 2, mine: 2 })
  })

  it('filters the free tab to groups with a Unit nobody has', () => {
    const session = build({ activeTab: 'free' })
    expect(session.visibleGroups.map((entry) => entry.group.name)).toEqual([
      'Бира',
      'Пица',
    ])
  })

  it('filters the mine tab to groups where the seat holds a Unit', () => {
    const session = build({ activeTab: 'mine' })
    expect(session.visibleGroups.map((entry) => entry.group.name)).toEqual([
      'Пица',
      'Салата',
    ])
  })

  it('applies search on top of the tab filter', () => {
    const session = build({ activeTab: 'free', search: 'пиц' })
    expect(session.visibleGroups.map((entry) => entry.group.name)).toEqual([
      'Пица',
    ])
    expect(session.hasSearchQuery).toBe(true)
  })

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

describe('resolveGuestClaimEmptyMessage', () => {
  it('prefers the no-items message', () => {
    expect(resolveGuestClaimEmptyMessage(false, 0, false, 'all')).toBe(
      GUEST_CLAIM_EMPTY_MESSAGES.noItems,
    )
  })

  it('returns null when groups are visible', () => {
    expect(resolveGuestClaimEmptyMessage(true, 2, false, 'mine')).toBeNull()
  })

  it('explains empty search results', () => {
    expect(resolveGuestClaimEmptyMessage(true, 0, true, 'all')).toBe(
      GUEST_CLAIM_EMPTY_MESSAGES.noSearchResults,
    )
  })

  it('explains an empty mine tab', () => {
    expect(resolveGuestClaimEmptyMessage(true, 0, false, 'mine')).toBe(
      GUEST_CLAIM_EMPTY_MESSAGES.noClaimed,
    )
  })

  it('explains an empty free tab', () => {
    expect(resolveGuestClaimEmptyMessage(true, 0, false, 'free')).toBe(
      GUEST_CLAIM_EMPTY_MESSAGES.allClaimed,
    )
  })
})
