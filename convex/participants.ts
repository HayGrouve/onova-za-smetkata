import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { requireAuth, requireBillOwner } from './lib/auth'
import { validateParticipantAdd } from './lib/participantSchema'
import { touchBill } from './lib/touchBill'
import { deleteGuestSessionsForParticipant } from './guestSessions'

const RECENT_NAMES_BILL_SCAN_LIMIT = 24

export const listRecentNames = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const max = args.limit ?? 12
    const bills = await ctx.db
      .query('bills')
      .withIndex('by_ownerId_updatedAt', (q) => q.eq('ownerId', userId))
      .order('desc')
      .take(RECENT_NAMES_BILL_SCAN_LIMIT)
    const seen = new Set<string>()
    const names: string[] = []
    for (const bill of bills) {
      const participants = await ctx.db
        .query('participants')
        .withIndex('by_billId', (q) => q.eq('billId', bill._id))
        .collect()
      for (const p of participants) {
        const key = p.name.trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        names.push(p.name.trim())
        if (names.length >= max) return names
      }
    }
    return names
  },
})

export const add = mutation({
  args: { billId: v.id('bills'), name: v.string() },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    if (bill.status === 'final') {
      throw new ConvexError('Сметката е завършена.')
    }

    const existing = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    const validated = validateParticipantAdd(
      { name: args.name },
      {
        existingNames: existing.map((participant) => participant.name),
        participantCount: existing.length,
      },
    )
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const id = await ctx.db.insert('participants', {
      billId: args.billId,
      name: validated.name,
      sortOrder: existing.length,
    })
    await touchBill(ctx, args.billId)
    return id
  },
})

export const remove = mutation({
  args: { participantId: v.id('participants') },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId)
    if (!participant) {
      throw new ConvexError('Участникът не е намерен.')
    }

    await requireBillOwner(ctx, participant.billId)

    const assignments = await ctx.db
      .query('itemAssignments')
      .withIndex('by_participantId', (q) =>
        q.eq('participantId', args.participantId),
      )
      .collect()
    for (const a of assignments) await ctx.db.delete(a._id)

    const payments = await ctx.db
      .query('payments')
      .withIndex('by_participantId', (q) =>
        q.eq('participantId', args.participantId),
      )
      .collect()
    for (const p of payments) {
      await ctx.db.delete(p._id)
    }

    await deleteGuestSessionsForParticipant(ctx, args.participantId)

    await ctx.db.delete(args.participantId)
    await touchBill(ctx, participant.billId)
  },
})
