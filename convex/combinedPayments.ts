import { ConvexError } from 'convex/values'
import { query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { requireBillOwner } from './lib/auth'
import { assertShareToken } from './lib/guestAccess'
import { calculateBillTotals, type BillTotals } from './lib/billCalculations'

async function loadBillTotalsForCombinedPay(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
): Promise<BillTotals> {
  const items = await ctx.db
    .query('items')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
  const participants = await ctx.db
    .query('participants')
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
  const bill = await ctx.db.get(billId)
  if (!bill) {
    throw new ConvexError('Сметката не е намерена.')
  }

  return calculateBillTotals({
    participants: participants.map((p) => ({
      id: p._id,
      sortOrder: p.sortOrder,
    })),
    items: items.map((i) => ({
      id: i._id,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
    })),
    assignments: assignments.map((a) => ({
      itemId: a.itemId,
      participantId: a.participantId,
      units: a.units,
    })),
    payments: payments.map((p) => ({
      participantId: p.participantId,
      amountCents: p.amountCents,
    })),
    tipCents: bill.tipCents ?? 0,
  })
}

export const getPendingForGuest = query({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)
    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) return null

    const pending = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_guestSessionId', (q) =>
        q.eq('guestSessionId', session._id),
      )
      .collect()

    return (
      pending.find((r) => r.billId === args.billId && r.status === 'pending') ??
      null
    )
  },
})

export const listPendingForBill = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    const pending = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_billId_status', (q) =>
        q.eq('billId', args.billId).eq('status', 'pending'),
      )
      .collect()
    return pending
  },
})
