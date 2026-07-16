import { mutation } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { requireBillOwner } from './lib/auth'
import { calculateBillTotals } from './lib/billCalculations'
import { validatePaymentAdd } from './lib/paymentAmountSchema'
import { touchBill } from './lib/touchBill'

export const add = mutation({
  args: {
    billId: v.id('bills'),
    participantId: v.id('participants'),
    amountCents: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)

    const participant = await ctx.db.get(args.participantId)
    if (!participant || participant.billId !== args.billId) {
      throw new ConvexError('Участникът не принадлежи на тази сметка.')
    }

    const items = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const participants = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const assignments = await ctx.db
      .query('itemAssignments')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const payments = await ctx.db
      .query('payments')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const bill = await ctx.db.get(args.billId)
    if (!bill) {
      throw new ConvexError('Сметката не е намерена.')
    }

    if (
      bill.hostParticipantId &&
      args.participantId === bill.hostParticipantId
    ) {
      throw new ConvexError('Домакинът не се маркира като платил.')
    }

    const totals = calculateBillTotals({
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
      hostParticipantId: bill.hostParticipantId,
    })

    const owedCents = totals.byParticipant[args.participantId]?.owedCents ?? 0
    const paidCents = payments
      .filter((payment) => payment.participantId === args.participantId)
      .reduce((sum, payment) => sum + payment.amountCents, 0)

    const validated = validatePaymentAdd(
      { amountCents: args.amountCents, note: args.note },
      { owedCents, paidCents },
    )
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const id = await ctx.db.insert('payments', {
      billId: args.billId,
      participantId: args.participantId,
      amountCents: validated.data.amountCents,
      note: validated.data.note,
      paidAt: Date.now(),
    })
    await touchBill(ctx, args.billId)
    return id
  },
})

export const undoLast = mutation({
  args: {
    billId: v.id('bills'),
    participantId: v.id('participants'),
  },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)

    const participant = await ctx.db.get(args.participantId)
    if (!participant || participant.billId !== args.billId) {
      throw new ConvexError('Участникът не принадлежи на тази сметка.')
    }

    const bill = await ctx.db.get(args.billId)
    if (!bill) {
      throw new ConvexError('Сметката не е намерена.')
    }

    if (
      bill.hostParticipantId &&
      args.participantId === bill.hostParticipantId
    ) {
      throw new ConvexError('Домакинът не се маркира като платил.')
    }

    const payments = await ctx.db
      .query('payments')
      .withIndex('by_participantId', (q) =>
        q.eq('participantId', args.participantId),
      )
      .collect()

    const lastPayment = payments.sort((a, b) => b.paidAt - a.paidAt)[0]

    if (!lastPayment) {
      throw new ConvexError('Няма плащания за отмяна.')
    }

    await ctx.db.delete(lastPayment._id)
    await touchBill(ctx, args.billId)
    return lastPayment._id
  },
})
