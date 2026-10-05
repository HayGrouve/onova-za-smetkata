import { describe, expect, it } from 'vitest'
import { nextSortOrder } from './sort-order'

describe('nextSortOrder', () => {
  it('starts at 0 and appends after the highest row', () => {
    expect(nextSortOrder([])).toBe(0)
    expect(nextSortOrder([{ sortOrder: 0 }, { sortOrder: 1 }])).toBe(2)
  })

  it('never reuses a sort order after a row in the middle was removed', () => {
    // Seats 0, 1, 2 — seat 1 left the bill.
    expect(nextSortOrder([{ sortOrder: 0 }, { sortOrder: 2 }])).toBe(3)
  })
})
