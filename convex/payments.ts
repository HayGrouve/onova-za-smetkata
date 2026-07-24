import { mutation } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { assertBillDraft } from './lib/assertBillDraft'
import { requireBillOwner } from './lib/auth'
import { calculateBillTotals } from './lib/billCalculations'
import { toBillCalculationSnapshot } from './lib/billCalculationSnapshot'
import { loadBillRelations } from './lib/billListSummary'
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

    const relations = await loadBillRelations(ctx, args.billId)
    const { payments } = relations
    const bill = await ctx.db.get(args.billId)
    if (!bill) {
      throw new ConvexError('Сметката не е намерена.')
    }
    assertBillDraft(bill)

    if (
      bill.hostParticipantId &&
      args.participantId === bill.hostParticipantId
    ) {
      throw new ConvexError('Домакинът не се маркира като платил.')
    }

    const { calculationInput } = toBillCalculationSnapshot(relations, {
      tipCents: bill.tipCents ?? 0,
      hostParticipantId: bill.hostParticipantId,
    })
    const totals = calculateBillTotals(calculationInput)

    const owedCents = totals.byParticipant[args.participantId].owedCents
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
    assertBillDraft(bill)

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

    if (payments.length === 0) {
      throw new ConvexError('Няма плащания за отмяна.')
    }

    const lastPayment = payments.reduce((latest, payment) =>
      payment.paidAt > latest.paidAt ? payment : latest,
    )

    await ctx.db.delete(lastPayment._id)
    await touchBill(ctx, args.billId)
    return lastPayment._id
  },
})
