import { describe, expect, it } from 'vitest'
import {
  firstUnassignedItemId,
  firstUnpricedItemId,
  resolveAllocationFocusKind,
} from './plan-allocation-focus.ts'

describe('resolveAllocationFocusKind', () => {
  it('points at add-item when there are no items', () => {
    expect(resolveAllocationFocusKind([], [])).toBe('add-item')
  })

  it('points at fix-price when an item lacks a price', () => {
    expect(
      resolveAllocationFocusKind(
        [{ id: 'i1', unitPriceCents: 0, quantity: 1 }],
        [],
      ),
    ).toBe('fix-price')
  })

  it('points at assign when items are priced but unassigned', () => {
    expect(
      resolveAllocationFocusKind(
        [{ id: 'i1', unitPriceCents: 500, quantity: 1 }],
        [],
      ),
    ).toBe('assign')
  })

  it('returns null when allocation is complete', () => {
    expect(
      resolveAllocationFocusKind(
        [{ id: 'i1', unitPriceCents: 500, quantity: 1 }],
        [{ itemId: 'i1', participantId: 'p1', unitIndex: 0 }],
      ),
    ).toBeNull()
  })
})

describe('firstUnpricedItemId', () => {
  it('returns the first item missing a price', () => {
    expect(
      firstUnpricedItemId([
        { id: 'i1', unitPriceCents: 500, quantity: 1 },
        { id: 'i2', unitPriceCents: 0, quantity: 1 },
      ]),
    ).toBe('i2')
  })
})

describe('firstUnassignedItemId', () => {
  it('returns the first item with uncovered units', () => {
    expect(
      firstUnassignedItemId(
        [
          { id: 'i1', unitPriceCents: 500, quantity: 1 },
          { id: 'i2', unitPriceCents: 300, quantity: 1 },
        ],
        [{ itemId: 'i1', participantId: 'p1', unitIndex: 0 }],
      ),
    ).toBe('i2')
  })
})
