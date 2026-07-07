import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { touchBill } from './lib/touchBill'
import { deleteGuestSessionsForParticipant } from './guestSessions'

export const listRecentNames = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const max = args.limit ?? 12
    const bills = await ctx.db
      .query('bills')
      .withIndex('by_updatedAt')
      .order('desc')
      .collect()
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
    const existing = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const id = await ctx.db.insert('participants', {
      billId: args.billId,
      name: args.name.trim(),
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
    if (!participant) return

    const assignments = await ctx.db
      .query('itemAssignments')
      .withIndex('by_participantId', (q) =>
        q.eq('participantId', args.participantId),
      )
      .collect()
    for (const a of assignments) await ctx.db.delete(a._id)

    const payments = await ctx.db
      .query('payments')
      .withIndex('by_billId', (q) => q.eq('billId', participant.billId))
      .collect()
    for (const p of payments.filter(
      (pay) => pay.participantId === args.participantId,
    )) {
      await ctx.db.delete(p._id)
    }

    await deleteGuestSessionsForParticipant(ctx, args.participantId)

    await ctx.db.delete(args.participantId)
    await touchBill(ctx, participant.billId)
  },
})
