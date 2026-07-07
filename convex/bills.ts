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

export const listWithSummary = query({
  args: {},
  handler: async (ctx) => {
    const bills = await ctx.db
      .query('bills')
      .withIndex('by_updatedAt')
      .order('desc')
      .collect()

    return await Promise.all(
      bills.map(async (bill) => {
        const participants = await ctx.db
          .query('participants')
          .withIndex('by_billId', (q) => q.eq('billId', bill._id))
          .collect()

        const items = await ctx.db
          .query('items')
          .withIndex('by_billId', (q) => q.eq('billId', bill._id))
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
          .withIndex('by_billId', (q) => q.eq('billId', bill._id))
          .collect()

        const billTotalCents =
          items.reduce(
            (sum, item) => sum + item.unitPriceCents * item.quantity,
            0,
          ) + (bill.tipCents ?? 0)

        let totalOutstandingCents: number | null = null

        if (bill.status === 'final') {
          const sortedParticipantIds = [...participants]
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((p) => p._id)

          const owedByParticipant = new Map<string, number>()
          for (const id of sortedParticipantIds) owedByParticipant.set(id, 0)

          for (const item of items) {
            const lineTotalCents = item.unitPriceCents * item.quantity
            const itemAssignments = assignments.filter((a) => a.itemId === item._id)
            const usesUnits = itemAssignments.some((a) => a.units !== undefined)

            if (usesUnits) {
              for (const assignment of itemAssignments) {
                const units = assignment.units ?? 0
                owedByParticipant.set(
                  assignment.participantId,
                  (owedByParticipant.get(assignment.participantId) ?? 0) +
                    units * item.unitPriceCents,
                )
              }
              continue
            }

            const assignedIds = new Set(
              itemAssignments.map((a) => a.participantId),
            )
            const sortedAssignedIds = sortedParticipantIds.filter((id) =>
              assignedIds.has(id),
            )
            const n = sortedAssignedIds.length
            if (n === 0) continue
            const base = Math.floor(lineTotalCents / n)
            const remainder = lineTotalCents % n
            sortedAssignedIds.forEach((id, index) => {
              const share = base + (index < remainder ? 1 : 0)
              owedByParticipant.set(
                id,
                (owedByParticipant.get(id) ?? 0) + share,
              )
            })
          }

          const paidByParticipant = new Map<string, number>()
          for (const payment of payments) {
            paidByParticipant.set(
              payment.participantId,
              (paidByParticipant.get(payment.participantId) ?? 0) +
                payment.amountCents,
            )
          }

          const tipCents = bill.tipCents ?? 0
          if (tipCents > 0 && sortedParticipantIds.length > 0) {
            const base = Math.floor(tipCents / sortedParticipantIds.length)
            const remainder = tipCents % sortedParticipantIds.length
            sortedParticipantIds.forEach((id, index) => {
              const share = base + (index < remainder ? 1 : 0)
              owedByParticipant.set(
                id,
                (owedByParticipant.get(id) ?? 0) + share,
              )
            })
          }

          totalOutstandingCents = sortedParticipantIds.reduce((sum, id) => {
            const owed = owedByParticipant.get(id) ?? 0
            const paid = paidByParticipant.get(id) ?? 0
            return sum + Math.max(0, owed - paid)
          }, 0)
        }

        return {
          bill,
          participantNames: participants.map((p) => p.name),
          billTotalCents,
          totalOutstandingCents,
        }
      }),
    )
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
    tipCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { billId, restaurantName, date, note, receiptStorageId, tipCents } =
      args
    await ctx.db.patch(billId, {
      updatedAt: Date.now(),
      ...(restaurantName !== undefined ? { restaurantName } : {}),
      ...(date !== undefined ? { date } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(receiptStorageId !== undefined ? { receiptStorageId } : {}),
      ...(tipCents !== undefined ? { tipCents } : {}),
    })
  },
})

export const finalize = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.billId)
    if (!bill) throw new Error('Bill not found')
    if (!bill.restaurantName.trim()) {
      throw new Error('Въведете име на ресторант.')
    }
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
