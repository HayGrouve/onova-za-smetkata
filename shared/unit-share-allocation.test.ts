import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  splitLineTotal,
  splitUnitShareAmongAssignees,
} from './unit-share-allocation'

describe('splitLineTotal', () => {
  it('assigns full amount to one person', () => {
    expect(splitLineTotal(1000, ['a'])).toEqual([{ id: 'a', cents: 1000 }])
  })

  it('splits evenly with remainder to first participants', () => {
    expect(splitLineTotal(100, ['a', 'b', 'c'])).toEqual([
      { id: 'a', cents: 34 },
      { id: 'b', cents: 33 },
      { id: 'c', cents: 33 },
    ])
  })
})

describe('splitUnitShareAmongAssignees', () => {
  it('orders assignees by participant sortOrder, not lexicographic id', () => {
    const participants = [
      { id: 'id_bbb', sortOrder: 0 },
      { id: 'id_aaa', sortOrder: 1 },
      { id: 'id_ccc', sortOrder: 2 },
    ]

    expect(
      splitUnitShareAmongAssignees(
        1000,
        ['id_aaa', 'id_bbb', 'id_ccc'],
        participants,
      ),
    ).toEqual([
      { id: 'id_bbb', cents: 334 },
      { id: 'id_aaa', cents: 333 },
      { id: 'id_ccc', cents: 333 },
    ])
  })
})

describe('Unit share allocation invariants', () => {
  const split = fc
    .record({
      unitPriceCents: fc.integer({ min: 0, max: 100_000 }),
      seatCount: fc.integer({ min: 1, max: 8 }),
    })
    .chain(({ unitPriceCents, seatCount }) =>
      fc.record({
        unitPriceCents: fc.constant(unitPriceCents),
        sortOrders: fc.shuffledSubarray(
          Array.from({ length: seatCount }, (_, index) => index),
          { minLength: seatCount, maxLength: seatCount },
        ),
      }),
    )

  it('hands out every cent, at most one cent apart, extra cents to earlier seats', () => {
    fc.assert(
      fc.property(split, ({ unitPriceCents, sortOrders }) => {
        const participants = sortOrders.map((sortOrder, index) => ({
          id: `p${index}`,
          sortOrder,
        }))
        const portions = splitUnitShareAmongAssignees(
          unitPriceCents,
          participants.map((participant) => participant.id),
          participants,
        )
        const cents = portions.map((portion) => portion.cents)

        expect(cents.reduce((sum, value) => sum + value, 0)).toBe(
          unitPriceCents,
        )
        expect(Math.max(...cents) - Math.min(...cents)).toBeLessThanOrEqual(1)
        // Portions come back in seat order and never grow along it.
        const orderOf = new Map(participants.map((p) => [p.id, p.sortOrder]))
        for (let index = 1; index < portions.length; index++) {
          expect(orderOf.get(portions[index].id)!).toBeGreaterThan(
            orderOf.get(portions[index - 1].id)!,
          )
          expect(portions[index].cents).toBeLessThanOrEqual(
            portions[index - 1].cents,
          )
        }
      }),
    )
  })
})
