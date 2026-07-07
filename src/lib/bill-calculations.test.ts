import { describe, expect, it } from 'vitest'
import type { BillCalculationInput } from './bill-calculations'
import { splitLineTotal, calculateBillTotals } from './bill-calculations'

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

describe('calculateBillTotals', () => {
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
})
