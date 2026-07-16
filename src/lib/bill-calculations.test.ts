import { describe, expect, it } from 'vitest'
import {
  splitLineTotal,
  splitUnits,
  calculateBillTotals,
  calculateParticipantBreakdown,
  validateBillForFinalize,
  totalOutstandingCents,
} from './bill-calculations'
import type {
  BillBreakdownInput,
  BillCalculationInput,
} from './bill-calculations'

function assertBillReconciles(input: BillCalculationInput) {
  const totals = calculateBillTotals(input)
  const itemsTotal =
    input.items.reduce(
      (sum, item) => sum + item.unitPriceCents * item.quantity,
      0,
    ) + (input.tipCents ?? 0)
  expect(totals.billTotalCents).toBe(itemsTotal)
  const sumOwed = Object.values(totals.byParticipant).reduce(
    (sum, participant) => sum + participant.owedCents,
    0,
  )
  expect(sumOwed).toBe(totals.billTotalCents)
  return totals
}

describe('splitLineTotal', () => {
  it('assigns full amount to one person', () => {
    expect(splitLineTotal(1000, ['a'])).toEqual([{ id: 'a', cents: 1000 }])
  })

  it('splits evenly with remainder to first participants', () => {
    const result = splitLineTotal(100, ['a', 'b', 'c'])
    expect(result).toEqual([
      { id: 'a', cents: 34 },
      { id: 'b', cents: 33 },
      { id: 'c', cents: 33 },
    ])
  })
})

describe('splitUnits', () => {
  it('splits 4 units among 3 people as 2,1,1', () => {
    expect(splitUnits(4, 3)).toEqual([2, 1, 1])
  })

  it('splits 2 units among 2 people as 1,1', () => {
    expect(splitUnits(2, 2)).toEqual([1, 1])
  })
})

describe('calculateBillTotals', () => {
  it('uses per-person units when provided', () => {
    const input: BillCalculationInput = {
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
        { id: 'p3', sortOrder: 2 },
      ],
      items: [{ id: 'i1', unitPriceCents: 229, quantity: 4 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1', units: 2 },
        { itemId: 'i1', participantId: 'p2', units: 1 },
        { itemId: 'i1', participantId: 'p3', units: 1 },
      ],
      payments: [],
    }
    const totals = calculateBillTotals(input)
    expect(totals.byParticipant.p1.owedCents).toBe(458)
    expect(totals.byParticipant.p2.owedCents).toBe(229)
    expect(totals.byParticipant.p3.owedCents).toBe(229)
  })

  it('computes owed, paid, and balance per participant', () => {
    const input: BillCalculationInput = {
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
      ],
      items: [
        { id: 'i1', unitPriceCents: 1000, quantity: 1 },
        { id: 'i2', unitPriceCents: 2000, quantity: 1 },
      ],
      assignments: [
        { itemId: 'i1', participantId: 'p1' },
        { itemId: 'i2', participantId: 'p2' },
      ],
      payments: [{ participantId: 'p1', amountCents: 1000 }],
    }
    const totals = calculateBillTotals(input)
    expect(totals.billTotalCents).toBe(3000)
    expect(totals.byParticipant.p1).toMatchObject({
      owedCents: 1000,
      paidCents: 1000,
      balanceCents: 0,
      status: 'paid',
    })
    expect(totals.byParticipant.p2).toMatchObject({
      owedCents: 2000,
      paidCents: 0,
      balanceCents: 2000,
      status: 'unpaid',
    })
  })

  it('splits tip equally among all participants', () => {
    const input: BillCalculationInput = {
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
        { id: 'p3', sortOrder: 2 },
      ],
      items: [{ id: 'i1', unitPriceCents: 900, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1' },
        { itemId: 'i1', participantId: 'p2' },
      ],
      payments: [],
      tipCents: 300,
    }
    const totals = calculateBillTotals(input)
    expect(totals.billTotalCents).toBe(1200)
    expect(totals.byParticipant.p1.owedCents).toBe(550)
    expect(totals.byParticipant.p2.owedCents).toBe(550)
    expect(totals.byParticipant.p3.owedCents).toBe(100)
  })
})

describe('validateBillForFinalize', () => {
  it('returns missing_restaurant when restaurant name is empty', () => {
    const errors = validateBillForFinalize({
      restaurantName: '   ',
      participants: [{ id: 'p1', sortOrder: 0 }],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [{ itemId: 'i1', participantId: 'p1' }],
    })
    expect(errors).toContainEqual({
      code: 'missing_restaurant',
      message: 'Въведете име на ресторант.',
    })
  })

  it('blocks finalize when any item is unassigned, including zero-price items', () => {
    const errors = validateBillForFinalize({
      restaurantName: 'Механа',
      participants: [{ id: 'p1', sortOrder: 0 }],
      items: [
        { id: 'i1', unitPriceCents: 1000, quantity: 1 },
        { id: 'i2', unitPriceCents: 0, quantity: 1 },
      ],
      assignments: [{ itemId: 'i1', participantId: 'p1' }],
    })
    expect(errors).toContainEqual({
      code: 'unassigned_items',
      message: 'Има 1 неразпределен артикул.',
    })
  })

  it('reports plural unassigned item count', () => {
    const errors = validateBillForFinalize({
      restaurantName: 'Механа',
      participants: [{ id: 'p1', sortOrder: 0 }],
      items: [
        { id: 'i1', unitPriceCents: 1000, quantity: 1 },
        { id: 'i2', unitPriceCents: 500, quantity: 1 },
      ],
      assignments: [],
    })
    expect(errors).toContainEqual({
      code: 'unassigned_items',
      message: 'Има 2 неразпределени артикула.',
    })
  })

  it('blocks finalize when a participant is not marked paid', () => {
    const errors = validateBillForFinalize({
      restaurantName: 'Механа',
      participants: [{ id: 'p1', sortOrder: 0 }],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [{ itemId: 'i1', participantId: 'p1' }],
      payments: [],
    })
    expect(errors).toContainEqual({
      code: 'unpaid_participants',
      message:
        'Маркирайте всички участници като платили, преди да завършите сметката.',
    })
  })

  it('allows finalize when every participant is paid', () => {
    const errors = validateBillForFinalize({
      restaurantName: 'Механа',
      participants: [{ id: 'p1', sortOrder: 0 }],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [{ itemId: 'i1', participantId: 'p1' }],
      payments: [{ participantId: 'p1', amountCents: 1000 }],
    })
    expect(errors.some((e) => e.code === 'unpaid_participants')).toBe(false)
  })
})

describe('bill reconciliation', () => {
  it('sum(owed) equals bill total for mixed unit and cent splits', () => {
    assertBillReconciles({
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
        { id: 'p3', sortOrder: 2 },
      ],
      items: [
        { id: 'i1', unitPriceCents: 1200, quantity: 1 },
        { id: 'i2', unitPriceCents: 229, quantity: 4 },
      ],
      assignments: [
        { itemId: 'i1', participantId: 'p1' },
        { itemId: 'i1', participantId: 'p2' },
        { itemId: 'i2', participantId: 'p1', units: 2 },
        { itemId: 'i2', participantId: 'p2', units: 1 },
        { itemId: 'i2', participantId: 'p3', units: 1 },
      ],
      payments: [{ participantId: 'p1', amountCents: 500 }],
      tipCents: 300,
    })
  })

  it('splits €10.00 evenly among 3 participants (remainder cents)', () => {
    const totals = assertBillReconciles({
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
        { id: 'p3', sortOrder: 2 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1' },
        { itemId: 'i1', participantId: 'p2' },
        { itemId: 'i1', participantId: 'p3' },
      ],
      payments: [],
    })
    expect(totals.byParticipant.p1.owedCents).toBe(334)
    expect(totals.byParticipant.p2.owedCents).toBe(333)
    expect(totals.byParticipant.p3.owedCents).toBe(333)
  })

  it('splits €10.01 evenly among 3 participants', () => {
    const totals = assertBillReconciles({
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
        { id: 'p3', sortOrder: 2 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1001, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'p1' },
        { itemId: 'i1', participantId: 'p2' },
        { itemId: 'i1', participantId: 'p3' },
      ],
      payments: [],
    })
    expect(totals.byParticipant.p1.owedCents).toBe(334)
    expect(totals.byParticipant.p2.owedCents).toBe(334)
    expect(totals.byParticipant.p3.owedCents).toBe(333)
  })

  it('totalOutstandingCents sums positive balances only', () => {
    const totals = calculateBillTotals({
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
      ],
      items: [
        { id: 'i1', unitPriceCents: 1000, quantity: 1 },
        { id: 'i2', unitPriceCents: 2000, quantity: 1 },
      ],
      assignments: [
        { itemId: 'i1', participantId: 'p1' },
        { itemId: 'i2', participantId: 'p2' },
      ],
      payments: [{ participantId: 'p1', amountCents: 1000 }],
    })
    expect(totalOutstandingCents(totals)).toBe(2000)
  })
})

describe('always-paid Host collection rule', () => {
  it('treats Host with Share > 0 and no payment rows as paid with zero outstanding', () => {
    const totals = calculateBillTotals({
      hostParticipantId: 'host',
      participants: [
        { id: 'host', sortOrder: 0 },
        { id: 'guest', sortOrder: 1 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'host' },
        { itemId: 'i1', participantId: 'guest' },
      ],
      payments: [],
    })

    expect(totals.byParticipant.host).toMatchObject({
      owedCents: 500,
      paidCents: 500,
      balanceCents: 0,
      status: 'paid',
    })
    expect(totals.byParticipant.guest).toMatchObject({
      owedCents: 500,
      paidCents: 0,
      balanceCents: 500,
      status: 'unpaid',
    })
    expect(totalOutstandingCents(totals)).toBe(500)
  })

  it('still splits tip across all Participants including Host with no claimed items', () => {
    const totals = calculateBillTotals({
      hostParticipantId: 'host',
      participants: [
        { id: 'host', sortOrder: 0 },
        { id: 'guest1', sortOrder: 1 },
        { id: 'guest2', sortOrder: 2 },
      ],
      items: [{ id: 'i1', unitPriceCents: 900, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'guest1' },
        { itemId: 'i1', participantId: 'guest2' },
      ],
      payments: [],
      tipCents: 300,
    })

    expect(totals.billTotalCents).toBe(1200)
    expect(totals.byParticipant.host.owedCents).toBe(100)
    expect(totals.byParticipant.host.status).toBe('paid')
    expect(totals.byParticipant.guest1.owedCents).toBe(550)
    expect(totals.byParticipant.guest2.owedCents).toBe(550)
  })

  it('keeps Host non-outstanding when Share grows without payment rows', () => {
    const before = calculateBillTotals({
      hostParticipantId: 'host',
      participants: [
        { id: 'host', sortOrder: 0 },
        { id: 'guest', sortOrder: 1 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [{ itemId: 'i1', participantId: 'guest' }],
      payments: [],
      tipCents: 0,
    })
    expect(before.byParticipant.host.owedCents).toBe(0)
    expect(before.byParticipant.host.status).toBe('paid')

    const after = calculateBillTotals({
      hostParticipantId: 'host',
      participants: [
        { id: 'host', sortOrder: 0 },
        { id: 'guest', sortOrder: 1 },
      ],
      items: [{ id: 'i1', unitPriceCents: 1000, quantity: 1 }],
      assignments: [
        { itemId: 'i1', participantId: 'host' },
        { itemId: 'i1', participantId: 'guest' },
      ],
      payments: [],
      tipCents: 0,
    })
    expect(after.byParticipant.host.owedCents).toBe(500)
    expect(after.byParticipant.host).toMatchObject({
      paidCents: 500,
      balanceCents: 0,
      status: 'paid',
    })
    expect(totalOutstandingCents(after)).toBe(500)
  })
})

describe('calculateParticipantBreakdown', () => {
  const baseInput: BillBreakdownInput = {
    participants: [
      { id: 'p1', sortOrder: 0 },
      { id: 'p2', sortOrder: 1 },
      { id: 'p3', sortOrder: 2 },
    ],
    items: [
      { id: 'i1', name: 'Пица', unitPriceCents: 1200, quantity: 1 },
      { id: 'i2', name: 'Кола', unitPriceCents: 229, quantity: 4 },
    ],
    assignments: [
      { itemId: 'i1', participantId: 'p1' },
      { itemId: 'i1', participantId: 'p2' },
      { itemId: 'i2', participantId: 'p1', units: 2 },
      { itemId: 'i2', participantId: 'p2', units: 1 },
      { itemId: 'i2', participantId: 'p3', units: 1 },
    ],
    tipCents: 300,
  }

  it('returns item lines with correct amounts for unit and equal splits', () => {
    const p1 = calculateParticipantBreakdown(baseInput, 'p1')
    expect(p1.itemsSubtotalCents).toBe(1058)
    expect(p1.tipCents).toBe(100)
    expect(p1.owedCents).toBe(1158)
    expect(p1.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'item',
          label: 'Пица',
          amountCents: 600,
          sharedWithCount: 1,
          sharedWithParticipantIds: ['p2'],
        }),
        expect.objectContaining({
          kind: 'item',
          label: 'Кола',
          amountCents: 458,
          units: 2,
          totalUnits: 4,
        }),
        expect.objectContaining({ kind: 'tip', amountCents: 100 }),
      ]),
    )
  })

  it('matches calculateBillTotals owedCents for every participant', () => {
    const totals = calculateBillTotals({
      ...baseInput,
      payments: [],
    })
    for (const p of baseInput.participants) {
      const breakdown = calculateParticipantBreakdown(baseInput, p.id)
      expect(breakdown.owedCents).toBe(totals.byParticipant[p.id].owedCents)
      expect(
        breakdown.lines.reduce((sum, line) => sum + line.amountCents, 0),
      ).toBe(breakdown.owedCents)
    }
  })
})
