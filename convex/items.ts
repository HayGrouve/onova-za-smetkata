import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { touchBill } from './lib/touchBill'

export const add = mutation({
  args: {
    billId: v.id('bills'),
    name: v.string(),
    unitPriceCents: v.number(),
    quantity: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const id = await ctx.db.insert('items', {
      billId: args.billId,
      name: args.name.trim(),
      unitPriceCents: args.unitPriceCents,
      quantity: args.quantity ?? 1,
      note: args.note,
      sortOrder: existing.length,
    })
    await touchBill(ctx, args.billId)
    return id
  },
})

export const update = mutation({
  args: {
    itemId: v.id('items'),
    name: v.optional(v.string()),
    unitPriceCents: v.optional(v.number()),
    quantity: v.optional(v.number()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId)
    if (!item) return

    const { itemId, ...fields } = args
    const patch: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = key === 'name' && typeof value === 'string' ? value.trim() : value
      }
    }
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(itemId, patch)
    }
    await touchBill(ctx, item.billId)
  },
})

export const remove = mutation({
  args: { itemId: v.id('items') },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId)
    if (!item) return

    const assignments = await ctx.db
      .query('itemAssignments')
      .withIndex('by_itemId', (q) => q.eq('itemId', args.itemId))
      .collect()
    for (const a of assignments) await ctx.db.delete(a._id)

    await ctx.db.delete(args.itemId)
    await touchBill(ctx, item.billId)
  },
})
