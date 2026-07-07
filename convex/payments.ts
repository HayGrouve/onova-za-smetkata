import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { touchBill } from './lib/touchBill'

export const add = mutation({
  args: {
    billId: v.id('bills'),
    participantId: v.id('participants'),
    amountCents: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('payments', {
      billId: args.billId,
      participantId: args.participantId,
      amountCents: args.amountCents,
      note: args.note,
      paidAt: Date.now(),
    })
    await touchBill(ctx, args.billId)
    return id
  },
})
