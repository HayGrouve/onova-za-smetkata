import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { touchBill } from './lib/touchBill'

export const toggle = mutation({
  args: {
    itemId: v.id('items'),
    participantId: v.id('participants'),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId)
    if (!item) return

    const existing = await ctx.db
      .query('itemAssignments')
      .withIndex('by_itemId', (q) => q.eq('itemId', args.itemId))
      .collect()
    const match = existing.find((a) => a.participantId === args.participantId)

    if (match) {
      await ctx.db.delete(match._id)
    } else {
      await ctx.db.insert('itemAssignments', {
        itemId: args.itemId,
        participantId: args.participantId,
      })
    }

    await touchBill(ctx, item.billId)
  },
})
