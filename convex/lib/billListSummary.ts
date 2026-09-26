import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { calculateBillTotals } from '../../shared/bill-calculations'
import { toBillCalculationSnapshot } from '../../shared/bill-calculation-snapshot'
import { buildBillCollectionFields } from '../../shared/bill-collection'

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

export interface StoredGuestBalance {
  participantId: Id<'participants'>
  name: string
  owedCents: number
  paidCents: number
}

/** Denormalized list + collection fields written onto `bills` by `touchBill`. */
export interface BillListSummaryFields {
  listBillTotalCents: number
  listOutstandingCents: number
  listParticipantNames: string[]
  listCollectedCents: number
  listGuestBalances: StoredGuestBalance[]
  listPrepared: boolean
  listFirstIncompleteStep: number
  listUnassignedItemCount: number
  listHasPricedItems: boolean
}

export function buildListSummaryFields(
  bill: {
    restaurantName: string
    tipCents?: number
    hostParticipantId?: string
  },
  relations: BillRelations,
): BillListSummaryFields {
  const { calculationInput } = toBillCalculationSnapshot(relations, {
    tipCents: bill.tipCents ?? 0,
    hostParticipantId: bill.hostParticipantId,
  })
  const totals = calculateBillTotals(calculationInput)

  const collection = buildBillCollectionFields({
    ...calculationInput,
    restaurantName: bill.restaurantName,
    participants: relations.participants.map((participant) => ({
      id: participant._id,
      name: participant.name,
      sortOrder: participant.sortOrder,
    })),
  })

  return {
    listBillTotalCents: totals.billTotalCents,
    listOutstandingCents: collection.outstandingCents,
    listParticipantNames: relations.participants.map(
      (participant) => participant.name,
    ),
    listCollectedCents: collection.collectedCents,
    listGuestBalances: collection.guestBalances.map((balance) => ({
      // Balances are built from `relations.participants[]._id`.
      participantId: balance.participantId as Id<'participants'>,
      name: balance.name,
      owedCents: balance.owedCents,
      paidCents: balance.paidCents,
    })),
    listPrepared: collection.prepared,
    listFirstIncompleteStep: collection.firstIncompleteStep,
    listUnassignedItemCount: collection.unassignedItemCount,
    listHasPricedItems: collection.hasPricedItems,
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
