import { describe, expect, it } from 'vitest'
import {
  filterGuestClaimItemsBySearch,
  filterUnclaimedGuestClaimItems,
  filterClaimedGuestClaimItems,
  getGuestClaimItemState,
  getOtherClaimantLabels,
  sortGuestClaimItems,
} from './guest-claim-items'
import type { Id } from '../../convex/_generated/dataModel'

const participantA = 'p-a' as Id<'participants'>
const participantB = 'p-b' as Id<'participants'>

describe('getGuestClaimItemState', () => {
  it('marks single-qty item as selected when participant joined unit 0', () => {
    const state = getGuestClaimItemState(
      { _id: 'item-1' as Id<'items'>, quantity: 1 },
      [
        {
          itemId: 'item-1' as Id<'items'>,
          participantId: participantA,
          unitIndex: 0,
        },
      ],
      participantA,
    )

    expect(state.isSelectedByMe).toBe(true)
    expect(state.myUnits).toBe(1)
  })

  it('keeps single-qty items available when assigned to others', () => {
    const state = getGuestClaimItemState(
      { _id: 'item-1' as Id<'items'>, quantity: 1 },
      [
        {
          itemId: 'item-1' as Id<'items'>,
          participantId: participantB,
          unitIndex: 0,
        },
      ],
      participantA,
    )

    expect(state.isSelectedByMe).toBe(false)
    expect(state.myUnits).toBe(0)
  })

  it('counts covered units and personal membership on multi-qty items', () => {
    const state = getGuestClaimItemState(
      { _id: 'item-1' as Id<'items'>, quantity: 3 },
      [
        {
          itemId: 'item-1' as Id<'items'>,
          participantId: participantB,
          unitIndex: 0,
        },
        {
          itemId: 'item-1' as Id<'items'>,
          participantId: participantA,
          unitIndex: 1,
        },
      ],
      participantA,
    )

    expect(state.myUnits).toBe(1)
    expect(state.coveredUnits).toBe(2)
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
        unitIndex: 0,
      },
    ]

    expect(
      filterUnclaimedGuestClaimItems(items, assignments, participantA).map(
        (item) => item._id,
      ),
    ).toEqual(['open'])
  })

  it('keeps multi-qty items when the participant has not joined every unit', () => {
    const items = [{ _id: 'multi' as Id<'items'>, name: 'Бира', quantity: 4 }]
    const assignments = [
      {
        itemId: 'multi' as Id<'items'>,
        participantId: participantA,
        unitIndex: 0,
      },
      {
        itemId: 'multi' as Id<'items'>,
        participantId: participantA,
        unitIndex: 1,
      },
    ]

    expect(
      filterUnclaimedGuestClaimItems(items, assignments, participantA).map(
        (item) => item._id,
      ),
    ).toEqual(['multi'])
  })

  it('removes multi-qty items when the participant joined every unit', () => {
    const items = [
      { _id: 'multi' as Id<'items'>, name: 'Бира', quantity: 3 },
      { _id: 'open' as Id<'items'>, name: 'Салата', quantity: 3 },
    ]
    const assignments = [
      {
        itemId: 'multi' as Id<'items'>,
        participantId: participantA,
        unitIndex: 0,
      },
      {
        itemId: 'multi' as Id<'items'>,
        participantId: participantA,
        unitIndex: 1,
      },
      {
        itemId: 'multi' as Id<'items'>,
        participantId: participantA,
        unitIndex: 2,
      },
    ]

    expect(
      filterUnclaimedGuestClaimItems(items, assignments, participantA).map(
        (item) => item._id,
      ),
    ).toEqual(['open'])
  })
})

describe('filterClaimedGuestClaimItems', () => {
  it('returns items claimed by the participant', () => {
    const items = [
      { _id: 'open' as Id<'items'>, name: 'Бира', quantity: 1 },
      { _id: 'claimed' as Id<'items'>, name: 'Салата', quantity: 1 },
    ]
    const assignments = [
      {
        itemId: 'claimed' as Id<'items'>,
        participantId: participantA,
        unitIndex: 0,
      },
    ]

    expect(
      filterClaimedGuestClaimItems(items, assignments, participantA).map(
        (item) => item._id,
      ),
    ).toEqual(['claimed'])
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

describe('getOtherClaimantLabels', () => {
  it('includes other participants on the same item', () => {
    expect(
      getOtherClaimantLabels(
        [
          {
            itemId: 'item-1' as Id<'items'>,
            participantId: participantB,
            unitIndex: 0,
          },
        ],
        participantA,
        { [participantB]: 'Мария' },
      ),
    ).toEqual(['Мария'])
  })
})
