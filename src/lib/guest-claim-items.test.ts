import { describe, expect, it } from 'vitest'
import {
  filterGuestClaimItemsBySearch,
  filterUnclaimedGuestClaimItems,
  getGuestClaimItemState,
  sortGuestClaimItems,
} from './guest-claim-items'
import type { Id } from '../../convex/_generated/dataModel'

const participantA = 'p-a' as Id<'participants'>
const participantB = 'p-b' as Id<'participants'>

describe('getGuestClaimItemState', () => {
  it('marks item unavailable when others claimed all units', () => {
    const state = getGuestClaimItemState(
      { _id: 'item-1' as Id<'items'>, quantity: 1 },
      [
        {
          itemId: 'item-1' as Id<'items'>,
          participantId: participantB,
          units: 1,
        },
      ],
      participantA,
    )

    expect(state.isUnavailableToMe).toBe(true)
    expect(state.isSelectedByMe).toBe(false)
    expect(state.remainingUnits).toBe(0)
  })

  it('keeps partial multi-qty items available', () => {
    const state = getGuestClaimItemState(
      { _id: 'item-1' as Id<'items'>, quantity: 3 },
      [
        {
          itemId: 'item-1' as Id<'items'>,
          participantId: participantB,
          units: 2,
        },
      ],
      participantA,
    )

    expect(state.isUnavailableToMe).toBe(false)
    expect(state.remainingUnits).toBe(1)
  })
})

describe('sortGuestClaimItems', () => {
  it('orders items by sortOrder regardless of selection state', () => {
    const items = [
      {
        _id: 'first' as Id<'items'>,
        name: 'Ябълка',
        sortOrder: 0,
        quantity: 1,
      },
      { _id: 'second' as Id<'items'>, name: 'Бира', sortOrder: 1, quantity: 1 },
      {
        _id: 'third' as Id<'items'>,
        name: 'Салата',
        sortOrder: 2,
        quantity: 4,
      },
      { _id: 'fourth' as Id<'items'>, name: 'Мезе', sortOrder: 3, quantity: 1 },
    ]

    expect(sortGuestClaimItems(items).map((item) => item._id)).toEqual([
      'first',
      'second',
      'third',
      'fourth',
    ])
  })
})

describe('filterUnclaimedGuestClaimItems', () => {
  it('removes single-qty items already claimed by the participant', () => {
    const items = [
      { _id: 'open' as Id<'items'>, name: 'Бира', quantity: 1 },
      { _id: 'claimed' as Id<'items'>, name: 'Салата', quantity: 1 },
    ]
    const assignments = [
      {
        itemId: 'claimed' as Id<'items'>,
        participantId: participantA,
        units: 1,
      },
    ]

    expect(
      filterUnclaimedGuestClaimItems(items, assignments, participantA).map(
        (item) => item._id,
      ),
    ).toEqual(['open'])
  })

  it('keeps multi-qty items in the list when more units can be claimed', () => {
    const items = [{ _id: 'multi' as Id<'items'>, name: 'Бира', quantity: 4 }]
    const assignments = [
      {
        itemId: 'multi' as Id<'items'>,
        participantId: participantA,
        units: 2,
      },
    ]

    expect(
      filterUnclaimedGuestClaimItems(items, assignments, participantA).map(
        (item) => item._id,
      ),
    ).toEqual(['multi'])
  })

  it('removes multi-qty items from the list when the participant is maxed out', () => {
    const items = [
      { _id: 'multi' as Id<'items'>, name: 'Бира', quantity: 3 },
      { _id: 'open' as Id<'items'>, name: 'Салата', quantity: 3 },
    ]
    const assignments = [
      {
        itemId: 'multi' as Id<'items'>,
        participantId: participantA,
        units: 3,
      },
    ]

    expect(
      filterUnclaimedGuestClaimItems(items, assignments, participantA).map(
        (item) => item._id,
      ),
    ).toEqual(['open'])
  })
})

describe('filterGuestClaimItemsBySearch', () => {
  it('filters items by name', () => {
    const items = [{ name: 'Салата' }, { name: 'Бира' }]

    expect(filterGuestClaimItemsBySearch(items, 'би')).toEqual([
      { name: 'Бира' },
    ])
    expect(filterGuestClaimItemsBySearch(items, '')).toEqual(items)
  })
})
