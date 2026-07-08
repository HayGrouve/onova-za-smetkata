import { internalMutation } from './_generated/server'

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
