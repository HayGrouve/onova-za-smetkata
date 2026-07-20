import { internalMutation } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { computeBillListSummary } from './lib/billListSummary'
import { createShareToken } from './lib/shareToken'

/** Run once after Area E: npx convex run backfill:refreshBillListSummaries */
export const refreshBillListSummaries = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bills = await ctx.db.query('bills').collect()
    let patched = 0
    for (const bill of bills) {
      const summary = await computeBillListSummary(ctx, bill._id)
      if (!summary) continue
      await ctx.db.patch(bill._id, {
        listBillTotalCents: summary.listBillTotalCents,
        listOutstandingCents: summary.listOutstandingCents,
        listParticipantNames: summary.listParticipantNames,
      })
      patched++
    }
    return { patched }
  },
})

/** Run once after Area E assignment index: npx convex run backfill:dedupeAssignments */
export const dedupeAssignments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const assignments = await ctx.db.query('itemAssignments').collect()
    const seen = new Map<string, Id<'itemAssignments'>>()
    let removed = 0

    for (const assignment of assignments) {
      const key = `${assignment.itemId}:${assignment.participantId}:${assignment.unitIndex}`
      const existingId = seen.get(key)
      if (existingId) {
        await ctx.db.delete(assignment._id)
        removed++
        continue
      }
      seen.set(key, assignment._id)
    }

    return { removed }
  },
})

/** Run once after adding billId to itemAssignments: npx convex run backfill:assignmentBillIds */
export const assignmentBillIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const assignments = await ctx.db.query('itemAssignments').collect()
    let patched = 0
    for (const assignment of assignments) {
      const record = assignment as typeof assignment & { billId?: unknown }
      if (record.billId) continue
      const item = await ctx.db.get(assignment.itemId)
      if (!item) continue
      await ctx.db.patch(assignment._id, { billId: item.billId })
      patched++
    }
    return { patched }
  },
})

/** Run once after adding shareToken: npx convex run backfill:shareTokens */
export const shareTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bills = await ctx.db.query('bills').collect()
    let patched = 0
    for (const bill of bills) {
      if (bill.shareToken) continue
      await ctx.db.patch(bill._id, { shareToken: createShareToken() })
      patched++
    }
    return { patched }
  },
})

/** One-time before per-unit membership deploy: npx convex run backfill:wipeItemAssignments */
export const wipeItemAssignments = internalMutation({
  args: {},
  handler: async (ctx) => {
    const assignments = await ctx.db.query('itemAssignments').collect()
    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id)
    }
    return { removed: assignments.length }
  },
})
