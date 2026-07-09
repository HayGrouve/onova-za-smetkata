import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { requireAuth, requireBillOwner } from './lib/auth'
import {
  FRIEND_GROUP_MAX_GROUPS,
  parseFriendGroupInput,
} from './lib/friendGroupSchema'
import {
  parseParticipantName,
  participantNameKey,
} from './lib/participantSchema'
import { BILL_PARTICIPANTS_MAX } from './lib/validation'
import { touchBill } from './lib/touchBill'

async function requireFriendGroupOwner(
  ctx: MutationCtx,
  groupId: Id<'friendGroups'>,
) {
  const userId = await requireAuth(ctx)
  const group = await ctx.db.get(groupId)
  if (!group || group.userId !== userId) {
    throw new ConvexError('Групата не е намерена.')
  }
  return group
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const groups = await ctx.db
      .query('friendGroups')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    return groups
      .filter((group) => group.memberNames.length > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((group) => ({
        _id: group._id,
        name: group.name,
        memberNames: group.memberNames,
        memberCount: group.memberNames.length,
        updatedAt: group.updatedAt,
      }))
  },
})

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const groups = await ctx.db
      .query('friendGroups')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    return groups
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((group) => ({
        _id: group._id,
        name: group.name,
        memberNames: group.memberNames,
        memberCount: group.memberNames.length,
        updatedAt: group.updatedAt,
      }))
  },
})

export const get = query({
  args: { groupId: v.id('friendGroups') },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const group = await ctx.db.get(args.groupId)
    if (!group || group.userId !== userId) {
      return null
    }
    return {
      _id: group._id,
      name: group.name,
      memberNames: group.memberNames,
      updatedAt: group.updatedAt,
    }
  },
})

export const create = mutation({
  args: {
    name: v.string(),
    memberNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const parsed = parseFriendGroupInput({
      name: args.name,
      memberNames: args.memberNames,
    })
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      throw new ConvexError(firstIssue?.message ?? 'Невалидна група')
    }

    const existing = await ctx.db
      .query('friendGroups')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    if (existing.length >= FRIEND_GROUP_MAX_GROUPS) {
      throw new ConvexError(
        `Можете да имате до ${FRIEND_GROUP_MAX_GROUPS} групи.`,
      )
    }

    const now = Date.now()
    return await ctx.db.insert('friendGroups', {
      userId,
      name: parsed.data.name,
      memberNames: parsed.data.memberNames,
      sortOrder: existing.length,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    groupId: v.id('friendGroups'),
    name: v.string(),
    memberNames: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const group = await requireFriendGroupOwner(ctx, args.groupId)

    const parsed = parseFriendGroupInput({
      name: args.name,
      memberNames: args.memberNames,
    })
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      throw new ConvexError(firstIssue?.message ?? 'Невалидна група')
    }

    await ctx.db.patch(group._id, {
      name: parsed.data.name,
      memberNames: parsed.data.memberNames,
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { groupId: v.id('friendGroups') },
  handler: async (ctx, args) => {
    const group = await requireFriendGroupOwner(ctx, args.groupId)
    await ctx.db.delete(group._id)
  },
})

export const addToBill = mutation({
  args: {
    billId: v.id('bills'),
    groupId: v.id('friendGroups'),
    names: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    const group = await requireFriendGroupOwner(ctx, args.groupId)

    const bill = await ctx.db.get(args.billId)
    if (!bill) {
      throw new ConvexError('Сметката не е намерена.')
    }
    if (bill.status === 'final') {
      throw new ConvexError('Сметката е завършена.')
    }

    const selectedNames =
      args.names?.map((name) => name.trim()).filter(Boolean) ??
      group.memberNames

    const existing = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const existingKeys = new Set(
      existing.map((p) => p.name.trim().toLowerCase()),
    )

    let added = 0
    let skipped = 0
    let sortOrder = existing.length

    for (const name of selectedNames) {
      if (existing.length + added >= BILL_PARTICIPANTS_MAX) {
        skipped += 1
        continue
      }

      const parsed = parseParticipantName(name)
      if (!parsed.success) {
        skipped += 1
        continue
      }

      const trimmedName = parsed.data
      const key = participantNameKey(trimmedName)
      if (existingKeys.has(key)) {
        skipped += 1
        continue
      }

      await ctx.db.insert('participants', {
        billId: args.billId,
        name: trimmedName,
        sortOrder,
      })
      existingKeys.add(key)
      sortOrder += 1
      added += 1
    }

    if (added > 0) {
      await touchBill(ctx, args.billId)
    }

    return { added, skipped }
  },
})
