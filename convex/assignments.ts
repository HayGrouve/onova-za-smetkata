import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { assertAssignmentEditable } from './lib/assertAssignmentEditable'
import { assertCanMutateAssignment } from './lib/assertCanMutateAssignment'
import { requireBillOwner } from './lib/auth'
import { touchBill } from './lib/touchBill'
import { assertRateLimit } from './lib/rateLimit'
import { itemHasEmptyUnit } from '../shared/unit-coverage'

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

async function deleteItemAssignments(
  ctx: MutationCtx,
  itemId: Id<'items'>,
) {
  const existing = await ctx.db
    .query('itemAssignments')
    .withIndex('by_itemId', (q) => q.eq('itemId', itemId))
    .collect()
  for (const assignment of existing) {
    await ctx.db.delete(assignment._id)
  }
}

async function syncEvenAssignments(
  ctx: MutationCtx,
  item: { _id: Id<'items'>; billId: Id<'bills'>; quantity: number },
  participantIds: Id<'participants'>[],
) {
  await deleteItemAssignments(ctx, item._id)
  if (participantIds.length === 0) return

  const sortedIds = await getSortedParticipantIds(
    ctx,
    item.billId,
    participantIds,
  )

  for (let unitIndex = 0; unitIndex < item.quantity; unitIndex++) {
    for (const participantId of sortedIds) {
      await ctx.db.insert('itemAssignments', {
        billId: item.billId,
        itemId: item._id,
        participantId,
        unitIndex,
      })
    }
  }
}

function assertUnitIndexInRange(
  item: { quantity: number },
  unitIndex: number,
) {
  if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= item.quantity) {
    throw new ConvexError('Невалиден номер на бройка.')
  }
}

async function findMembership(
  ctx: MutationCtx,
  itemId: Id<'items'>,
  participantId: Id<'participants'>,
  unitIndex: number,
) {
  return await ctx.db
    .query('itemAssignments')
    .withIndex('by_itemId_participantId_unitIndex', (q) =>
      q
        .eq('itemId', itemId)
        .eq('participantId', participantId)
        .eq('unitIndex', unitIndex),
    )
    .unique()
}

async function mutateUnitMembership(
  ctx: MutationCtx,
  args: {
    itemId: Id<'items'>
    participantId: Id<'participants'>
    unitIndex: number
    sessionToken?: string
    join: boolean
    rateLimitKey: string
  },
) {
  const item = await ctx.db.get(args.itemId)
  if (!item) {
    throw new ConvexError('Артикулът не е намерен.')
  }

  const bill = await ctx.db.get(item.billId)
  if (!bill) {
    throw new ConvexError('Сметката не е намерена.')
  }

  await assertUnitIndexInRange(item, args.unitIndex)

  await assertCanMutateAssignment(ctx, {
    billId: item.billId,
    participantId: args.participantId,
    sessionToken: args.sessionToken,
  })

  if (args.sessionToken) {
    await assertRateLimit(ctx, args.rateLimitKey, 60, 60_000)
  }

  const participant = await ctx.db.get(args.participantId)
  assertAssignmentEditable({
    billStatus: bill.status,
    itemBillId: item.billId,
    participantBillId: participant?.billId,
  })

  const existing = await findMembership(
    ctx,
    args.itemId,
    args.participantId,
    args.unitIndex,
  )

  if (args.join) {
    if (!existing) {
      await ctx.db.insert('itemAssignments', {
        billId: item.billId,
        itemId: args.itemId,
        participantId: args.participantId,
        unitIndex: args.unitIndex,
      })
    }
  } else if (existing) {
    await ctx.db.delete(existing._id)
  }

  await touchBill(ctx, item.billId)
}

export const joinUnit = mutation({
  args: {
    itemId: v.id('items'),
    participantId: v.id('participants'),
    unitIndex: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await mutateUnitMembership(ctx, {
      ...args,
      join: true,
      rateLimitKey: `assign:joinUnit:${args.sessionToken ?? args.participantId}`,
    })
  },
})

export const leaveUnit = mutation({
  args: {
    itemId: v.id('items'),
    participantId: v.id('participants'),
    unitIndex: v.number(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await mutateUnitMembership(ctx, {
      ...args,
      join: false,
      rateLimitKey: `assign:leaveUnit:${args.sessionToken ?? args.participantId}`,
    })
  },
})

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

    if (item.quantity !== 1) {
      throw new ConvexError(
        'За артикули с количество над 1 използвайте Сподели.',
      )
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
      await assertRateLimit(
        ctx,
        `assign:toggle:${args.sessionToken}`,
        60,
        60_000,
      )
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
      if (
        args.mode === 'unassigned_only' &&
        !itemHasEmptyUnit(
          {
            id: item._id,
            unitPriceCents: item.unitPriceCents,
            quantity: item.quantity,
          },
          existing.map((assignment) => ({
            itemId: assignment.itemId,
            participantId: assignment.participantId,
            unitIndex: assignment.unitIndex,
          })),
        )
      ) {
        continue
      }

      await syncEvenAssignments(ctx, item, participantIds)
    }
    await touchBill(ctx, args.billId)
  },
})
