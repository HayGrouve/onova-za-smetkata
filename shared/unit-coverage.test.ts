import { describe, expect, it } from 'vitest'
import {
  countCoveredUnits,
  countItemsWithEmptyUnits,
  countUnitsJoinedByParticipant,
  itemHasEmptyUnit,
  itemHasFullUnitCoverage,
  participantIdsOnUnit,
} from './unit-coverage'

const item = { id: 'i1', unitPriceCents: 100, quantity: 3 }

describe('unit coverage', () => {
  it('detects empty units when some indexes have no members', () => {
    const assignments = [
      { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
      { itemId: 'i1', participantId: 'p2', unitIndex: 2 },
    ]
    expect(itemHasEmptyUnit(item, assignments)).toBe(true)
    expect(countCoveredUnits(item, assignments)).toBe(2)
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
    expect(countCoveredUnits(item, [])).toBe(0)
  })

  it('lists participants on a unit and counts multi-unit membership', () => {
    const assignments = [
      { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
      { itemId: 'i1', participantId: 'p2', unitIndex: 0 },
      { itemId: 'i1', participantId: 'p1', unitIndex: 2 },
    ]
    expect(participantIdsOnUnit('i1', 0, assignments).sort()).toEqual([
      'p1',
      'p2',
    ])
    expect(countUnitsJoinedByParticipant('i1', 'p1', assignments)).toBe(2)
  })
})
