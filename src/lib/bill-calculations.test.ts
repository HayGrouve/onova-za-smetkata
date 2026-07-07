import { describe, expect, it } from 'vitest'
import type { BillCalculationInput } from './bill-calculations'
import {
  splitLineTotal,
  splitUnits,
  calculateBillTotals,
  calculateParticipantBreakdown,
  type BillBreakdownInput,
} from './bill-calculations'

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
