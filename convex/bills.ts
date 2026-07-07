import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('bills')
      .withIndex('by_updatedAt')
      .order('desc')
      .collect()
  },
})

export const get = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.billId)
    if (!bill) return null

    const participants = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    const items = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    const assignments = (
      await Promise.all(
        items.map((item) =>
          ctx.db
            .query('itemAssignments')
            .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
            .collect(),
        ),
      )
    ).flat()

    const payments = await ctx.db
      .query('payments')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    return { bill, participants, items, assignments, payments }
  },
})

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('bills', {
      restaurantName: '',
      date: now,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    billId: v.id('bills'),
    restaurantName: v.optional(v.string()),
    date: v.optional(v.number()),
    note: v.optional(v.string()),
    receiptStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const { billId, ...fields } = args
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value
    }
    await ctx.db.patch(billId, patch)
  },
})

export const finalize = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.billId, {
      status: 'final',
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const items = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const payments = await ctx.db
      .query('payments')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    for (const item of items) {
      const assignments = await ctx.db
        .query('itemAssignments')
        .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
        .collect()
      for (const a of assignments) await ctx.db.delete(a._id)
      await ctx.db.delete(item._id)
    }
    for (const p of participants) await ctx.db.delete(p._id)
    for (const pay of payments) await ctx.db.delete(pay._id)
    await ctx.db.delete(args.billId)
  },
})
