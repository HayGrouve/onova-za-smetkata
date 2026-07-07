import { describe, expect, it } from 'vitest'
import {
  filterGuestClaimItemsBySearch,
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
      [{ itemId: 'item-1' as Id<'items'>, participantId: participantB, units: 1 }],
      participantA,
    )

    expect(state.isUnavailableToMe).toBe(true)
    expect(state.isSelectedByMe).toBe(false)
    expect(state.remainingUnits).toBe(0)
  })

  it('keeps partial multi-qty items available', () => {
    const state = getGuestClaimItemState(
      { _id: 'item-1' as Id<'items'>, quantity: 3 },
      [{ itemId: 'item-1' as Id<'items'>, participantId: participantB, units: 2 }],
      participantA,
    )

    expect(state.isUnavailableToMe).toBe(false)
    expect(state.remainingUnits).toBe(1)
  })
})

describe('sortGuestClaimItems', () => {
  it('orders available, unavailable, then selected items alphabetically', () => {
    const items = [
      { _id: 'selected-b' as Id<'items'>, name: 'Ябълка', sortOrder: 0, quantity: 1 },
      { _id: 'available-b' as Id<'items'>, name: 'Бира', sortOrder: 1, quantity: 1 },
      { _id: 'available-a' as Id<'items'>, name: 'Айран', sortOrder: 2, quantity: 1 },
      { _id: 'selected-a' as Id<'items'>, name: 'Салата', sortOrder: 3, quantity: 1 },
      { _id: 'unavailable' as Id<'items'>, name: 'Мезе', sortOrder: 4, quantity: 1 },
    ]
    const assignments = [
      {
        itemId: 'selected-b' as Id<'items'>,
        participantId: participantA,
        units: 1,
      },
      {
        itemId: 'selected-a' as Id<'items'>,
        participantId: participantA,
        units: 1,
      },
      {
        itemId: 'unavailable' as Id<'items'>,
        participantId: participantB,
        units: 1,
      },
    ]

    expect(
      sortGuestClaimItems(items, assignments, participantA).map((item) => item._id),
    ).toEqual(['available-a', 'available-b', 'unavailable', 'selected-a', 'selected-b'])
  })
})

describe('filterGuestClaimItemsBySearch', () => {
  it('filters items by name', () => {
    const items = [
      { name: 'Салата' },
      { name: 'Бира' },
    ]

    expect(filterGuestClaimItemsBySearch(items, 'би')).toEqual([{ name: 'Бира' }])
    expect(filterGuestClaimItemsBySearch(items, '')).toEqual(items)
  })
})
