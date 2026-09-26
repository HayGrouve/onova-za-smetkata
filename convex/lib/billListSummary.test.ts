import { describe, expect, it } from 'vitest'
import { buildListSummaryFields } from './billListSummary'
import type { BillRelations } from './billListSummary'

function relations(input: {
  participants: Array<{ _id: string; name: string; sortOrder: number }>
  items: Array<{ _id: string; unitPriceCents: number; quantity: number }>
  assignments?: Array<{
    itemId: string
    participantId: string
    unitIndex: number
  }>
  payments?: Array<{ participantId: string; amountCents: number }>
}): BillRelations {
  return {
    participants: input.participants,
    items: input.items.map((item) => ({ name: 'Артикул', ...item })),
    assignments: input.assignments ?? [],
    payments: input.payments ?? [],
  } as never
}

describe('buildListSummaryFields', () => {
  it('computes draft totals from items and tip, same as items + tip', () => {
    const summary = buildListSummaryFields(
      { restaurantName: '', tipCents: 200 },
      relations({
        participants: [{ _id: 'p1', name: 'Иван', sortOrder: 0 }],
        items: [{ _id: 'i1', unitPriceCents: 1000, quantity: 2 }],
      }),
    )

    expect(summary.listBillTotalCents).toBe(2 * 1000 + 200)
    expect(summary.listParticipantNames).toEqual(['Иван'])
    expect(summary.listPrepared).toBe(false)
    expect(summary.listFirstIncompleteStep).toBe(1)
    expect(summary.listUnassignedItemCount).toBe(1)
    expect(summary.listHasPricedItems).toBe(true)
  })

  it('computes outstanding and collection fields for drafts too', () => {
    const summary = buildListSummaryFields(
      { restaurantName: 'Механа', tipCents: 0, hostParticipantId: 'p1' },
      relations({
        participants: [
          { _id: 'p1', name: 'Домакин', sortOrder: 0 },
          { _id: 'p2', name: 'Мария', sortOrder: 1 },
        ],
        items: [{ _id: 'i1', unitPriceCents: 1000, quantity: 2 }],
        assignments: [
          { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
          { itemId: 'i1', participantId: 'p2', unitIndex: 1 },
        ],
        payments: [{ participantId: 'p2', amountCents: 300 }],
      }),
    )

    expect(summary).toEqual({
      listBillTotalCents: 2000,
      listOutstandingCents: 700,
      listParticipantNames: ['Домакин', 'Мария'],
      listCollectedCents: 300,
      listGuestBalances: [
        { participantId: 'p2', name: 'Мария', owedCents: 1000, paidCents: 300 },
      ],
      listPrepared: true,
      listFirstIncompleteStep: 4,
      listUnassignedItemCount: 0,
      listHasPricedItems: true,
    })
  })

  it('computes outstanding from assignments and payments', () => {
    const summary = buildListSummaryFields(
      { restaurantName: 'Механа', tipCents: 0 },
      relations({
        participants: [
          { _id: 'p1', name: 'Иван', sortOrder: 0 },
          { _id: 'p2', name: 'Мария', sortOrder: 1 },
        ],
        items: [{ _id: 'i1', unitPriceCents: 1000, quantity: 1 }],
        assignments: [
          { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
          { itemId: 'i1', participantId: 'p2', unitIndex: 0 },
        ],
        payments: [{ participantId: 'p2', amountCents: 500 }],
      }),
    )

    expect(summary.listBillTotalCents).toBe(1000)
    expect(summary.listOutstandingCents).toBe(500)
    expect(summary.listCollectedCents).toBe(500)
    expect(summary.listParticipantNames).toEqual(['Иван', 'Мария'])
  })

  it('excludes Host balance from list outstanding when hostParticipantId is set', () => {
    const summary = buildListSummaryFields(
      { restaurantName: 'Механа', tipCents: 0, hostParticipantId: 'p1' },
      relations({
        participants: [
          { _id: 'p1', name: 'Домакин', sortOrder: 0 },
          { _id: 'p2', name: 'Мария', sortOrder: 1 },
        ],
        items: [{ _id: 'i1', unitPriceCents: 1000, quantity: 1 }],
        assignments: [
          { itemId: 'i1', participantId: 'p1', unitIndex: 0 },
          { itemId: 'i1', participantId: 'p2', unitIndex: 0 },
        ],
      }),
    )

    expect(summary.listBillTotalCents).toBe(1000)
    expect(summary.listOutstandingCents).toBe(500)
    expect(summary.listGuestBalances.map((b) => b.participantId)).toEqual([
      'p2',
    ])
  })
})
