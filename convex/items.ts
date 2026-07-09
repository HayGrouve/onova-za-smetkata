import { mutation } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { requireBillOwner } from './lib/auth'
import { assertNonNegativeIntCents, assertPositiveQuantity } from './lib/money'
import { sumAssignedUnits } from './lib/clampParticipantUnits'
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
    await requireBillOwner(ctx, args.billId)
    const unitPriceCents = assertNonNegativeIntCents(
      args.unitPriceCents,
      'Цената',
    )
    const quantity = assertPositiveQuantity(args.quantity ?? 1)
    const existing = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const id = await ctx.db.insert('items', {
      billId: args.billId,
      name: args.name.trim(),
      unitPriceCents,
      quantity,
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
    if (!item) {
      throw new ConvexError('Артикулът не е намерен.')
    }

    await requireBillOwner(ctx, item.billId)

    if (args.unitPriceCents !== undefined) {
      assertNonNegativeIntCents(args.unitPriceCents, 'Цената')
    }
    if (args.quantity !== undefined) {
      assertPositiveQuantity(args.quantity)
    }

    if (args.quantity !== undefined && args.quantity < item.quantity) {
      const assignments = await ctx.db
        .query('itemAssignments')
        .withIndex('by_itemId', (q) => q.eq('itemId', args.itemId))
        .collect()
      const usesUnits = assignments.some(
        (assignment) => assignment.units !== undefined,
      )
      if (usesUnits) {
        const assignedUnits = sumAssignedUnits(assignments)
        if (assignedUnits > args.quantity) {
          throw new ConvexError(
            'Намалете разпределенията преди да намалите количеството.',
          )
        }
      }
    }

    const { itemId, name, unitPriceCents, quantity, note } = args
    const patch = {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(unitPriceCents !== undefined ? { unitPriceCents } : {}),
      ...(quantity !== undefined ? { quantity } : {}),
      ...(note !== undefined ? { note } : {}),
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
    if (!item) {
      throw new ConvexError('Артикулът не е намерен.')
    }

    await requireBillOwner(ctx, item.billId)

    const assignments = await ctx.db
      .query('itemAssignments')
      .withIndex('by_itemId', (q) => q.eq('itemId', args.itemId))
      .collect()
    for (const a of assignments) await ctx.db.delete(a._id)

    await ctx.db.delete(args.itemId)
    await touchBill(ctx, item.billId)
  },
})
