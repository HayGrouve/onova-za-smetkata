import { describe, expect, it } from 'vitest'
import { buildListSummaryFields } from '../../convex/lib/billListSummary'

describe('buildListSummaryFields', () => {
  it('computes draft totals from items and tip without outstanding', () => {
    const summary = buildListSummaryFields(
      { status: 'draft', tipCents: 200 },
      {
        participants: [{ _id: 'p1', name: 'Иван', sortOrder: 0 } as never],
        items: [
          {
            _id: 'i1',
            unitPriceCents: 1000,
            quantity: 2,
          } as never,
        ],
        assignments: [],
        payments: [],
      },
    )

    expect(summary.listBillTotalCents).toBe(2200)
    expect(summary.listOutstandingCents).toBeUndefined()
    expect(summary.listParticipantNames).toEqual(['Иван'])
  })

  it('computes final outstanding from assignments and payments', () => {
    const summary = buildListSummaryFields(
      { status: 'final', tipCents: 0 },
      {
        participants: [
          { _id: 'p1', name: 'Иван', sortOrder: 0 } as never,
          { _id: 'p2', name: 'Мария', sortOrder: 1 } as never,
        ],
        items: [
          {
            _id: 'i1',
            unitPriceCents: 1000,
            quantity: 1,
          } as never,
        ],
        assignments: [
          { itemId: 'i1', participantId: 'p1', unitIndex: 0 } as never,
          { itemId: 'i1', participantId: 'p2', unitIndex: 0 } as never,
        ],
        payments: [{ participantId: 'p2', amountCents: 500 } as never],
      },
    )

    expect(summary.listBillTotalCents).toBe(1000)
    expect(summary.listOutstandingCents).toBe(500)
    expect(summary.listParticipantNames).toEqual(['Иван', 'Мария'])
  })

  it('excludes Host balance from list outstanding when hostParticipantId is set', () => {
    const summary = buildListSummaryFields(
      {
        status: 'final',
        tipCents: 0,
        hostParticipantId: 'p1',
      },
      {
        participants: [
          { _id: 'p1', name: 'Домакин', sortOrder: 0 } as never,
          { _id: 'p2', name: 'Мария', sortOrder: 1 } as never,
        ],
        items: [
          {
            _id: 'i1',
            unitPriceCents: 1000,
            quantity: 1,
          } as never,
        ],
        assignments: [
          { itemId: 'i1', participantId: 'p1', unitIndex: 0 } as never,
          { itemId: 'i1', participantId: 'p2', unitIndex: 0 } as never,
        ],
        payments: [],
      },
    )

    expect(summary.listBillTotalCents).toBe(1000)
    expect(summary.listOutstandingCents).toBe(500)
  })
})
