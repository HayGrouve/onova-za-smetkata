import { describe, expect, it } from 'vitest'
import {
  countItemsWithEmptyUnits,
  itemHasEmptyUnit,
  itemHasFullUnitCoverage,
} from './unit-coverage'

const item = { id: 'i1', unitPriceCents: 100, quantity: 3 }

describe('unit coverage', () => {
  it('detects empty units when some indexes have no members', () => {
    const assignments = [
      { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
      { itemId: 'i1', participantId: 'p2', unitIndex: 2 },
    ]
    expect(itemHasEmptyUnit(item, assignments)).toBe(true)
    expect(countItemsWithEmptyUnits([item], assignments)).toBe(1)
  })

  it('passes when every unit index has at least one member', () => {
    const assignments = [
      { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
      { itemId: 'i1', participantId: 'p1', unitIndex: 1 },
      { itemId: 'i1', participantId: 'p2', unitIndex: 2 },
    ]
    expect(itemHasFullUnitCoverage(item, assignments)).toBe(true)
    expect(countItemsWithEmptyUnits([item], assignments)).toBe(0)
  })

  it('treats an item with no rows as fully empty', () => {
    expect(itemHasEmptyUnit(item, [])).toBe(true)
  })

  it('ignores rows for other items', () => {
    expect(
      itemHasEmptyUnit({ ...item, quantity: 1 }, [
        { itemId: 'other', participantId: 'p1', unitIndex: 0 },
      ]),
    ).toBe(true)
  })
})
