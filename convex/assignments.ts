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

export const assignAll = mutation({
  args: {
    billId: v.id('bills'),
    mode: v.union(v.literal('all_items'), v.literal('unassigned_only')),
  },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const items = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    for (const item of items) {
      const existing = await ctx.db
        .query('itemAssignments')
        .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
        .collect()
      if (args.mode === 'unassigned_only' && existing.length > 0) continue

      for (const a of existing) await ctx.db.delete(a._id)
      for (const p of participants) {
        await ctx.db.insert('itemAssignments', {
          itemId: item._id,
          participantId: p._id,
        })
      }
    }
    await touchBill(ctx, args.billId)
  },
})
