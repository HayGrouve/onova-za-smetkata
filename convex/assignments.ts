import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { assertAssignmentEditable } from './lib/assertAssignmentEditable'
import { clampParticipantUnits } from './lib/clampParticipantUnits'
import { splitUnits } from './lib/splitUnits'
import { touchBill } from './lib/touchBill'

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

  const sortedIds = await getSortedParticipantIds(ctx, item.billId, participantIds)
  const units = splitUnits(item.quantity, sortedIds.length)

  for (let index = 0; index < sortedIds.length; index++) {
    const participantId = sortedIds[index]
    const unitCount = units[index] ?? 0
    if (!participantId || unitCount <= 0) continue
    await ctx.db.insert('itemAssignments', {
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
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId)
    if (!item) return

    const bill = await ctx.db.get(item.billId)
    if (!bill) return
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
          .filter((assignment) => assignment.participantId !== args.participantId)
          .map((assignment) => assignment.participantId)
      : [...existing.map((assignment) => assignment.participantId), args.participantId]

    await syncEvenAssignments(ctx, item, nextParticipantIds)
    await touchBill(ctx, item.billId)
  },
})

export const setUnits = mutation({
  args: {
    itemId: v.id('items'),
    participantId: v.id('participants'),
    units: v.number(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.itemId)
    if (!item) return

    const bill = await ctx.db.get(item.billId)
    if (!bill) return
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

    const clampedUnits = clampParticipantUnits({
      itemQuantity: item.quantity,
      requestedUnits: args.units,
      existingAssignments: existing.map((assignment) => ({
        participantId: assignment.participantId,
        units: assignment.units,
      })),
      participantId: args.participantId,
    })
    const match = existing.find(
      (assignment) => assignment.participantId === args.participantId,
    )

    if (clampedUnits === 0) {
      if (match) await ctx.db.delete(match._id)
      await touchBill(ctx, item.billId)
      return
    }

    if (match) {
      await ctx.db.patch(match._id, { units: clampedUnits })
    } else {
      await ctx.db.insert('itemAssignments', {
        itemId: args.itemId,
        participantId: args.participantId,
        units: clampedUnits,
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
