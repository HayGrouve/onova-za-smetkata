import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { assertAssignmentEditable } from './lib/assertAssignmentEditable'
import { assertCanMutateAssignment } from './lib/assertCanMutateAssignment'
import { clampParticipantUnits } from './lib/clampParticipantUnits'
import { requireBillOwner } from './lib/auth'
import { splitUnits } from './lib/billCalculations'
import { touchBill } from './lib/touchBill'
import { assertRateLimit } from './lib/rateLimit'

async function getSortedParticipantIds(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  participantIds: Id<'participants'>[],
): Promise<Id<'participants'>[]> {
  const participants = await ctx.db
    .query('participants')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
  const order = new Map(
    participants.map((participant) => [participant._id, participant.sortOrder]),
  )
  return [...participantIds].sort(
    (a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0),
  )
}

async function normalizeItemAssignmentModes(
  ctx: MutationCtx,
  item: { _id: Id<'items'>; billId: Id<'bills'>; quantity: number },
) {
  const existing = await ctx.db
    .query('itemAssignments')
    .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
    .collect()
  if (existing.length === 0) return

  if (item.quantity === 1) {
    for (const assignment of existing) {
      if (assignment.units !== undefined) {
        await ctx.db.replace(assignment._id, {
          billId: assignment.billId,
          itemId: assignment.itemId,
          participantId: assignment.participantId,
        })
      }
    }
    return
  }

  const hasUnits = existing.some((assignment) => assignment.units !== undefined)
  const hasCentOnly = existing.some((assignment) => assignment.units === undefined)
  if (!hasUnits || !hasCentOnly) return

  for (const assignment of existing) {
    if (assignment.units === undefined) {
      await ctx.db.patch(assignment._id, { units: 0 })
    }
  }
}

async function syncEvenAssignments(
  ctx: MutationCtx,
  item: { _id: Id<'items'>; billId: Id<'bills'>; quantity: number },
  participantIds: Id<'participants'>[],
) {
  const existing = await ctx.db
    .query('itemAssignments')
    .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
    .collect()
  for (const assignment of existing) {
    await ctx.db.delete(assignment._id)
  }

  if (participantIds.length === 0) return

  const sortedIds = await getSortedParticipantIds(
    ctx,
    item.billId,
    participantIds,
  )

  if (item.quantity === 1) {
    for (const participantId of sortedIds) {
      await ctx.db.insert('itemAssignments', {
        billId: item.billId,
        itemId: item._id,
        participantId,
      })
    }
    return
  }

  const units = splitUnits(item.quantity, sortedIds.length)

  for (let index = 0; index < sortedIds.length; index++) {
    const participantId = sortedIds[index]
    const unitCount = units[index] ?? 0
    if (!participantId || unitCount <= 0) continue
    await ctx.db.insert('itemAssignments', {
      billId: item.billId,
      itemId: item._id,
      participantId,
      units: unitCount,
    })
  }
}

export const toggle = mutation({
  args: {
    itemId: v.id('items'),
    participantId: v.id('participants'),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId)
    if (!item) {
      throw new ConvexError('Артикулът не е намерен.')
    }

    const bill = await ctx.db.get(item.billId)
    if (!bill) {
      throw new ConvexError('Сметката не е намерена.')
    }

    await assertCanMutateAssignment(ctx, {
      billId: item.billId,
      participantId: args.participantId,
      sessionToken: args.sessionToken,
    })

    if (args.sessionToken) {
      await assertRateLimit(ctx, `assign:toggle:${args.sessionToken}`, 60, 60_000)
    }

    const participant = await ctx.db.get(args.participantId)
    assertAssignmentEditable({
      billStatus: bill.status,
      itemBillId: item.billId,
      participantBillId: participant?.billId,
    })

    const existing = await ctx.db
      .query('itemAssignments')
      .withIndex('by_itemId', (q) => q.eq('itemId', args.itemId))
      .collect()
    const isAssigned = existing.some(
      (assignment) => assignment.participantId === args.participantId,
    )

    const nextParticipantIds = isAssigned
      ? existing
          .filter(
            (assignment) => assignment.participantId !== args.participantId,
          )
          .map((assignment) => assignment.participantId)
      : [
          ...existing.map((assignment) => assignment.participantId),
          args.participantId,
        ]

    await syncEvenAssignments(ctx, item, nextParticipantIds)
    await touchBill(ctx, item.billId)
  },
})

export const setUnits = mutation({
  args: {
    itemId: v.id('items'),
    participantId: v.id('participants'),
    units: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId)
    if (!item) {
      throw new ConvexError('Артикулът не е намерен.')
    }

    const bill = await ctx.db.get(item.billId)
    if (!bill) {
      throw new ConvexError('Сметката не е намерена.')
    }

    if (item.quantity === 1) {
      throw new ConvexError(
        'Единичните артикули се разпределят чрез избор на участници.',
      )
    }

    await assertCanMutateAssignment(ctx, {
      billId: item.billId,
      participantId: args.participantId,
      sessionToken: args.sessionToken,
    })

    if (args.sessionToken) {
      await assertRateLimit(ctx, `assign:setUnits:${args.sessionToken}`, 60, 60_000)
    }

    const participant = await ctx.db.get(args.participantId)
    assertAssignmentEditable({
      billStatus: bill.status,
      itemBillId: item.billId,
      participantBillId: participant?.billId,
    })

    const existingAssignment = await ctx.db
      .query('itemAssignments')
      .withIndex('by_itemId_participantId', (q) =>
        q.eq('itemId', args.itemId).eq('participantId', args.participantId),
      )
      .unique()

    const existing = await ctx.db
      .query('itemAssignments')
      .withIndex('by_itemId', (q) => q.eq('itemId', args.itemId))
      .collect()

    const clampedUnits = clampParticipantUnits({
      itemQuantity: item.quantity,
      requestedUnits: args.units,
      existingAssignments: existing.map((assignment) => ({
        participantId: assignment.participantId,
        units: assignment.units,
      })),
      participantId: args.participantId,
    })

    if (clampedUnits === 0) {
      if (existingAssignment) await ctx.db.delete(existingAssignment._id)
      await normalizeItemAssignmentModes(ctx, item)
      await touchBill(ctx, item.billId)
      return
    }

    if (existingAssignment) {
      await ctx.db.patch(existingAssignment._id, { units: clampedUnits })
    } else {
      await ctx.db.insert('itemAssignments', {
        billId: item.billId,
        itemId: args.itemId,
        participantId: args.participantId,
        units: clampedUnits,
      })
    }

    await normalizeItemAssignmentModes(ctx, item)
    await touchBill(ctx, item.billId)
  },
})

export const assignEven = mutation({
  args: { itemId: v.id('items') },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId)
    if (!item) {
      throw new ConvexError('Артикулът не е намерен.')
    }

    const bill = await ctx.db.get(item.billId)
    if (!bill) {
      throw new ConvexError('Сметката не е намерена.')
    }
    if (bill.status === 'final') {
      throw new ConvexError('Сметката е приключена и не може да се редактира.')
    }

    await requireBillOwner(ctx, item.billId)

    const participants = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', item.billId))
      .collect()
    const participantIds = participants
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((participant) => participant._id)

    await syncEvenAssignments(ctx, item, participantIds)
    await touchBill(ctx, item.billId)
  },
})

export const assignAll = mutation({
  args: {
    billId: v.id('bills'),
    mode: v.union(v.literal('all_items'), v.literal('unassigned_only')),
  },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    if (bill.status === 'final') {
      throw new ConvexError('Сметката е приключена и не може да се редактира.')
    }
    const participants = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const items = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    const participantIds = participants
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((participant) => participant._id)

    for (const item of items) {
      const existing = await ctx.db
        .query('itemAssignments')
        .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
        .collect()
      if (args.mode === 'unassigned_only' && existing.length > 0) continue

      await syncEvenAssignments(ctx, item, participantIds)
    }
    await touchBill(ctx, args.billId)
  },
})
