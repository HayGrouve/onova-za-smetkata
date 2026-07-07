import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query('paymentSettings').first()
    if (!row) {
      return { revolutUsername: undefined, iban: undefined }
    }
    return {
      revolutUsername: row.revolutUsername,
      iban: row.iban,
    }
  },
})

export const save = mutation({
  args: {
    revolutUsername: v.optional(v.string()),
    iban: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const revolutUsername = args.revolutUsername?.trim() || undefined
    const iban = args.iban?.trim() || undefined
    const data = {
      revolutUsername,
      iban,
      updatedAt: Date.now(),
    }

    const existing = await ctx.db.query('paymentSettings').first()
    if (existing) {
      await ctx.db.patch(existing._id, data)
    } else {
      await ctx.db.insert('paymentSettings', data)
    }
  },
})
