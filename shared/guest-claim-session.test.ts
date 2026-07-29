import { describe, expect, it } from 'vitest'
import {
  buildGuestClaimSessionState,
  GUEST_CLAIM_EMPTY_MESSAGES,
  resolveGuestClaimEmptyMessage,
} from './guest-claim-session'

const participantA = 'p-a'
const participantB = 'p-b'

const items = [
  { id: 'open', name: 'Бира', quantity: 1, sortOrder: 0 },
  { id: 'multi', name: 'Пици', quantity: 3, sortOrder: 1 },
  { id: 'claimed', name: 'Салата', quantity: 1, sortOrder: 2 },
]

const assignments = [
  { itemId: 'claimed', participantId: participantA, unitIndex: 0 },
  { itemId: 'multi', participantId: participantA, unitIndex: 0 },
  { itemId: 'multi', participantId: participantB, unitIndex: 1 },
]

describe('buildGuestClaimSessionState', () => {
  it('filters remaining tab items and counts tabs', () => {
    const session = buildGuestClaimSessionState({
      items,
      assignments,
      participantId: participantA,
      activeTab: 'remaining',
      search: '',
    })

    expect(session.remainingCount).toBe(2)
    expect(session.claimedCount).toBe(2)
    expect(session.visibleItems.map((entry) => entry.item.id)).toEqual([
      'open',
      'multi',
    ])
    expect(session.hidePrices).toBe(false)
    expect(session.showSearch).toBe(true)
  })

  it('filters mine tab items and hides prices', () => {
    const session = buildGuestClaimSessionState({
      items,
      assignments,
      participantId: participantA,
      activeTab: 'mine',
      search: '',
    })

    expect(session.visibleItems.map((entry) => entry.item.id)).toEqual([
      'multi',
      'claimed',
    ])
    expect(session.hidePrices).toBe(true)
    expect(session.showSearch).toBe(true)
  })

  it('applies search on top of tab filter', () => {
    const session = buildGuestClaimSessionState({
      items,
      assignments,
      participantId: participantA,
      activeTab: 'remaining',
      search: 'пиц',
    })

    expect(session.visibleItems.map((entry) => entry.item.id)).toEqual([
      'multi',
    ])
    expect(session.hasSearchQuery).toBe(true)
  })

  it('includes claim state per visible item', () => {
    const session = buildGuestClaimSessionState({
      items,
      assignments,
      participantId: participantA,
      activeTab: 'mine',
      search: '',
    })

    const multi = session.visibleItems.find(
      (entry) => entry.item.id === 'multi',
    )
    expect(multi?.claimState.myUnits).toBe(1)
    expect(multi?.claimState.isSelectedByMe).toBe(true)
  })

  it('indexes assignments by item id', () => {
    const session = buildGuestClaimSessionState({
      items,
      assignments,
      participantId: participantA,
      activeTab: 'remaining',
      search: '',
    })

    expect(session.assignmentsByItemId.multi).toHaveLength(2)
    expect(session.assignmentsByItemId.open).toBeUndefined()
  })

  it('builds share drawer input when bill relations are provided', () => {
    const session = buildGuestClaimSessionState({
      items: [
        {
          id: 'i1',
          name: 'Салата',
          quantity: 1,
          sortOrder: 0,
        },
      ],
      assignments: [
        { itemId: 'i1', participantId: participantA, unitIndex: 0 },
      ],
      participantId: participantA,
      activeTab: 'mine',
      search: '',
      billRelations: {
        participants: [
          { _id: participantA, sortOrder: 0 },
          { _id: participantB, sortOrder: 1 },
        ],
        items: [
          {
            _id: 'i1',
            name: 'Салата',
            unitPriceCents: 1200,
            quantity: 1,
          },
        ],
        assignments: [
          { itemId: 'i1', participantId: participantA, unitIndex: 0 },
        ],
        payments: [],
      },
      billContext: { tipCents: 0, hostParticipantId: participantB },
      participantLabels: { [participantA]: 'Иван' },
    })

    expect(session.shareDrawer?.participantTotals.owedCents).toBe(1200)
    expect(session.shareDrawer?.shareView.statusLabel).toBe('неплатено')
    expect(session.shareDrawer?.shareView.lines).toHaveLength(1)
  })
})

describe('resolveGuestClaimEmptyMessage', () => {
  it('returns tab-specific empty copy', () => {
    expect(resolveGuestClaimEmptyMessage(true, 0, false, 'mine')).toBe(
      GUEST_CLAIM_EMPTY_MESSAGES.noClaimed,
    )
    expect(resolveGuestClaimEmptyMessage(true, 0, false, 'remaining')).toBe(
      GUEST_CLAIM_EMPTY_MESSAGES.allClaimed,
    )
    expect(resolveGuestClaimEmptyMessage(true, 0, true, 'remaining')).toBe(
      GUEST_CLAIM_EMPTY_MESSAGES.noSearchResults,
    )
    expect(resolveGuestClaimEmptyMessage(false, 0, false, 'remaining')).toBe(
      GUEST_CLAIM_EMPTY_MESSAGES.noItems,
    )
    expect(resolveGuestClaimEmptyMessage(true, 2, false, 'remaining')).toBe(
      null,
    )
  })
})
