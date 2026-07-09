import { mutation } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { requireBillOwner } from './lib/auth'
import { sumAssignedUnits } from './lib/clampParticipantUnits'
import {
  validateItemAddArgs,
  validateItemUpdatePatch,
} from './lib/itemSchema'
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
    const bill = await requireBillOwner(ctx, args.billId)
    if (bill.status === 'final') {
      throw new ConvexError('Сметката е завършена.')
    }

    const validated = validateItemAddArgs({
      name: args.name,
      unitPriceCents: args.unitPriceCents,
      quantity: args.quantity,
      note: args.note,
    })
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const existing = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const id = await ctx.db.insert('items', {
      billId: args.billId,
      name: validated.data.name,
      unitPriceCents: validated.data.unitPriceCents,
      quantity: validated.data.quantity,
      note: validated.data.note,
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

    const bill = await requireBillOwner(ctx, item.billId)
    if (bill.status === 'final') {
      throw new ConvexError('Сметката е завършена.')
    }

    const validated = validateItemUpdatePatch({
      name: args.name,
      unitPriceCents: args.unitPriceCents,
      quantity: args.quantity,
      note: args.note,
    })
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    if (
      validated.data.quantity !== undefined &&
      validated.data.quantity < item.quantity
    ) {
      const assignments = await ctx.db
        .query('itemAssignments')
        .withIndex('by_itemId', (q) => q.eq('itemId', args.itemId))
        .collect()
      const usesUnits = assignments.some(
        (assignment) => assignment.units !== undefined,
      )
      if (usesUnits) {
        const assignedUnits = sumAssignedUnits(assignments)
        if (assignedUnits > validated.data.quantity) {
          throw new ConvexError(
            'Намалете разпределенията преди да намалите количеството.',
          )
        }
      }
    }

    const patch = validated.data
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(args.itemId, patch)
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
