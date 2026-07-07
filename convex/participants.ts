import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { touchBill } from './lib/touchBill'

export const add = mutation({
  args: { billId: v.id('bills'), name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const id = await ctx.db.insert('participants', {
      billId: args.billId,
      name: args.name.trim(),
      sortOrder: existing.length,
    })
    await touchBill(ctx, args.billId)
    return id
  },
})

export const remove = mutation({
  args: { participantId: v.id('participants') },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId)
    if (!participant) return

    const assignments = await ctx.db
      .query('itemAssignments')
      .withIndex('by_participantId', (q) =>
        q.eq('participantId', args.participantId),
      )
      .collect()
    for (const a of assignments) await ctx.db.delete(a._id)

    const payments = await ctx.db
      .query('payments')
      .withIndex('by_billId', (q) => q.eq('billId', participant.billId))
      .collect()
    for (const p of payments.filter(
      (pay) => pay.participantId === args.participantId,
    )) {
      await ctx.db.delete(p._id)
    }

    await ctx.db.delete(args.participantId)
    await touchBill(ctx, participant.billId)
  },
})
