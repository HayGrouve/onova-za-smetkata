import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { calculateBillTotals, totalOutstandingCents } from './billCalculations'
import { toBillCalculationSnapshot } from './billCalculationSnapshot'

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

  const { calculationInput } = toBillCalculationSnapshot(relations, {
    tipCents: bill.tipCents ?? 0,
    hostParticipantId: bill.hostParticipantId,
  })
  const totals = calculateBillTotals(calculationInput)

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
