import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { assertAssignmentEditable } from './lib/assertAssignmentEditable'
import { assertCanMutateAssignment } from './lib/assertCanMutateAssignment'
import { requireBillOwner } from './lib/auth'
import { touchBill } from './lib/touchBill'
import { assertRateLimit } from './lib/rateLimit'
import { itemHasEmptyUnit } from '../shared/unit-coverage'
import { CLAIM_MESSAGES } from '../shared/claim-messages'
import {
  planReleaseUnit,
  planShareUnit,
  planTakeUnit,
} from '../shared/unit-claim-plan'
import { GUEST_FLOW_MESSAGES } from '../shared/guest-flow-messages'

/** Most identical lines a Claim group can span in one call. */
const CLAIM_GROUP_ITEMS_MAX = 50

const unitRefValidator = v.object({
  itemId: v.id('items'),
  unitIndex: v.number(),
})

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

async function deleteItemAssignments(ctx: MutationCtx, itemId: Id<'items'>) {
  const existing = await ctx.db
    .query('itemAssignments')
    .withIndex('by_itemId', (q) => q.eq('itemId', itemId))
    .collect()
  for (const assignment of existing) {
    await ctx.db.delete(assignment._id)
  }
}

async function insertUnitMembership(
  ctx: MutationCtx,
  args: {
    billId: Id<'bills'>
    itemId: Id<'items'>
    participantId: Id<'participants'>
    unitIndex: number
  },
) {
  await ctx.db.insert('itemAssignments', {
    billId: args.billId,
    itemId: args.itemId,
    participantId: args.participantId,
    unitIndex: args.unitIndex,
  })
}

async function applyEvenSplitToItem(
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
      await insertUnitMembership(ctx, {
        billId: item.billId,
        itemId: item._id,
        participantId,
        unitIndex,
      })
    }
  }
}

function assertUnitIndexInRange(item: { quantity: number }, unitIndex: number) {
  if (
    !Number.isInteger(unitIndex) ||
    unitIndex < 0 ||
    unitIndex >= item.quantity
  ) {
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
      await insertUnitMembership(ctx, {
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

/**
 * Shared prelude for Claim group mutations: every item on one bill, caller may
 * act for `participantId`, bill still draft. Returns Units in group order.
 */
async function loadClaimGroup(
  ctx: MutationCtx,
  args: {
    itemIds: Id<'items'>[]
    participantId: Id<'participants'>
    sessionToken?: string
    rateLimitKey: string
  },
) {
  const itemIds = [...new Set(args.itemIds)]
  if (itemIds.length === 0 || itemIds.length > CLAIM_GROUP_ITEMS_MAX) {
    throw new ConvexError(CLAIM_MESSAGES.invalidItems)
  }

  const items: Doc<'items'>[] = []
  for (const itemId of itemIds) {
    const item = await ctx.db.get(itemId)
    if (!item) {
      throw new ConvexError('Артикулът не е намерен.')
    }
    items.push(item)
  }
  const billId = items[0].billId
  if (items.some((item) => item.billId !== billId)) {
    throw new ConvexError(CLAIM_MESSAGES.invalidItems)
  }

  const bill = await ctx.db.get(billId)
  if (!bill) {
    throw new ConvexError('Сметката не е намерена.')
  }

  await assertCanMutateAssignment(ctx, {
    billId,
    participantId: args.participantId,
    sessionToken: args.sessionToken,
  })

  if (args.sessionToken) {
    await assertRateLimit(ctx, args.rateLimitKey, 60, 60_000)
  }

  const participant = await ctx.db.get(args.participantId)
  assertAssignmentEditable({
    billStatus: bill.status,
    itemBillId: billId,
    participantBillId: participant?.billId,
  })

  items.sort((a, b) => a.sortOrder - b.sortOrder)
  const units = items.flatMap((item) =>
    Array.from({ length: item.quantity }, (_, unitIndex) => ({
      itemId: item._id,
      unitIndex,
    })),
  )

  const assignments: Doc<'itemAssignments'>[] = []
  for (const item of items) {
    const rows = await ctx.db
      .query('itemAssignments')
      .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
      .collect()
    assignments.push(...rows)
  }

  return { billId, units, assignments }
}

async function assertParticipantsOnBill(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  participantIds: Id<'participants'>[],
) {
  for (const participantId of participantIds) {
    const participant = await ctx.db.get(participantId)
    if (!participant || participant.billId !== billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.participantNotOnBill)
    }
  }
}

/** Put `participantId` alone on the first free Unit of a Claim group. */
export const takeUnit = mutation({
  args: {
    itemIds: v.array(v.id('items')),
    participantId: v.id('participants'),
    sessionToken: v.optional(v.string()),
  },
  returns: unitRefValidator,
  handler: async (ctx, args) => {
    const { billId, units, assignments } = await loadClaimGroup(ctx, {
      ...args,
      rateLimitKey: `assign:takeUnit:${args.sessionToken ?? args.participantId}`,
    })

    const plan = planTakeUnit({ units, assignments })
    if (!plan.ok) {
      throw new ConvexError(plan.message)
    }

    const itemId = plan.unit.itemId as Id<'items'>
    await insertUnitMembership(ctx, {
      billId,
      itemId,
      participantId: args.participantId,
      unitIndex: plan.unit.unitIndex,
    })
    await touchBill(ctx, billId)
    return { itemId, unitIndex: plan.unit.unitIndex }
  },
})

/** Remove `participantId` from the last Unit they hold alone in a Claim group. */
export const releaseUnit = mutation({
  args: {
    itemIds: v.array(v.id('items')),
    participantId: v.id('participants'),
    sessionToken: v.optional(v.string()),
  },
  returns: unitRefValidator,
  handler: async (ctx, args) => {
    const { billId, units, assignments } = await loadClaimGroup(ctx, {
      ...args,
      rateLimitKey: `assign:releaseUnit:${args.sessionToken ?? args.participantId}`,
    })

    const plan = planReleaseUnit({
      units,
      assignments,
      participantId: args.participantId,
    })
    if (!plan.ok) {
      throw new ConvexError(plan.message)
    }

    const itemId = plan.unit.itemId as Id<'items'>
    const existing = await findMembership(
      ctx,
      itemId,
      args.participantId,
      plan.unit.unitIndex,
    )
    if (existing) {
      await ctx.db.delete(existing._id)
    }
    await touchBill(ctx, billId)
    return { itemId, unitIndex: plan.unit.unitIndex }
  },
})

/**
 * Explicit share: set who splits a Unit with `participantId`. Callers may add or
 * remove other Participants only on a Unit `participantId` is on (or takes here).
 */
export const shareUnit = mutation({
  args: {
    itemIds: v.array(v.id('items')),
    participantId: v.id('participants'),
    withParticipantIds: v.array(v.id('participants')),
    unit: v.optional(unitRefValidator),
    sessionToken: v.optional(v.string()),
  },
  returns: unitRefValidator,
  handler: async (ctx, args) => {
    const { billId, units, assignments } = await loadClaimGroup(ctx, {
      itemIds: args.itemIds,
      participantId: args.participantId,
      sessionToken: args.sessionToken,
      rateLimitKey: `assign:shareUnit:${args.sessionToken ?? args.participantId}`,
    })

    await assertParticipantsOnBill(ctx, billId, args.withParticipantIds)

    const plan = planShareUnit({
      units,
      assignments,
      actorId: args.participantId,
      withParticipantIds: args.withParticipantIds,
      unit: args.unit,
    })
    if (!plan.ok) {
      throw new ConvexError(plan.message)
    }

    const itemId = plan.unit.itemId as Id<'items'>
    const unitIndex = plan.unit.unitIndex
    for (const participantId of plan.add) {
      await insertUnitMembership(ctx, {
        billId,
        itemId,
        participantId: participantId as Id<'participants'>,
        unitIndex,
      })
    }
    for (const participantId of plan.remove) {
      const existing = await findMembership(
        ctx,
        itemId,
        participantId as Id<'participants'>,
        unitIndex,
      )
      if (existing) {
        await ctx.db.delete(existing._id)
      }
    }
    await touchBill(ctx, billId)
    return { itemId, unitIndex }
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

    await applyEvenSplitToItem(ctx, item, participantIds)
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

      await applyEvenSplitToItem(ctx, item, participantIds)
    }
    await touchBill(ctx, args.billId)
  },
})
