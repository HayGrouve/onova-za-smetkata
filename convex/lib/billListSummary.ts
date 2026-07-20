import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { calculateBillTotals, totalOutstandingCents } from './billCalculations'

export async function loadBillRelations(ctx: QueryCtx, billId: Id<'bills'>) {
  const participants = await ctx.db
    .query('participants')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()

  const items = await ctx.db
    .query('items')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()

  const assignments = await ctx.db
    .query('itemAssignments')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()

  const payments = await ctx.db
    .query('payments')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()

  return { participants, items, assignments, payments }
}

export type BillRelations = Awaited<ReturnType<typeof loadBillRelations>>

export function buildListSummaryFields(
  bill: {
    status: 'draft' | 'final'
    tipCents?: number
    hostParticipantId?: string
  },
  relations: BillRelations,
): {
  listBillTotalCents: number
  listOutstandingCents?: number
  listParticipantNames: string[]
} {
  const listParticipantNames = relations.participants.map(
    (participant) => participant.name,
  )

  if (bill.status === 'draft') {
    const listBillTotalCents =
      relations.items.reduce(
        (sum, item) => sum + item.unitPriceCents * item.quantity,
        0,
      ) + (bill.tipCents ?? 0)

    return {
      listBillTotalCents,
      listParticipantNames,
    }
  }

  const totals = calculateBillTotals({
    participants: relations.participants.map((participant) => ({
      id: participant._id,
      sortOrder: participant.sortOrder,
    })),
    items: relations.items.map((item) => ({
      id: item._id,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
    assignments: relations.assignments.map((assignment) => ({
      itemId: assignment.itemId,
      participantId: assignment.participantId,
      unitIndex: assignment.unitIndex,
    })),
    payments: relations.payments.map((payment) => ({
      participantId: payment.participantId,
      amountCents: payment.amountCents,
    })),
    tipCents: bill.tipCents ?? 0,
    hostParticipantId: bill.hostParticipantId,
  })

  return {
    listBillTotalCents: totals.billTotalCents,
    listOutstandingCents: totalOutstandingCents(totals),
    listParticipantNames,
  }
}

export async function computeBillListSummary(
  ctx: QueryCtx,
  billId: Id<'bills'>,
) {
  const bill = await ctx.db.get(billId)
  if (!bill) return null
  const relations = await loadBillRelations(ctx, billId)
  return buildListSummaryFields(bill, relations)
}
