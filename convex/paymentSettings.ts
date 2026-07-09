import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { requireAuth } from './lib/auth'
import { assertShareToken } from './lib/guestAccess'
import { parsePaymentSettingsInput } from './lib/paymentSettingsSchema'

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const row = await ctx.db
      .query('paymentSettings')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()
    return {
      revolutUsername: row?.revolutUsername,
      iban: row?.iban,
    }
  },
})

export const getForGuest = query({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
  },
  handler: async (ctx, args) => {
    const bill = await assertShareToken(ctx, args.billId, args.shareToken)

    const row = await ctx.db
      .query('paymentSettings')
      .withIndex('by_userId', (q) => q.eq('userId', bill.ownerId))
      .unique()

    return {
      revolutUsername: row?.revolutUsername,
      iban: row?.iban,
    }
  },
})

export const save = mutation({
  args: {
    revolutUsername: v.optional(v.string()),
    iban: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)

    const parsed = parsePaymentSettingsInput({
      revolutUsername: args.revolutUsername ?? '',
      iban: args.iban ?? '',
    })
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      throw new ConvexError(
        firstIssue?.message ?? 'Невалидни настройки за плащане',
      )
    }

    const data = {
      revolutUsername: parsed.data.revolutUsername,
      iban: parsed.data.iban,
      updatedAt: Date.now(),
    }

    const existing = await ctx.db
      .query('paymentSettings')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .unique()

    if (existing) {
      await ctx.db.patch(existing._id, data)
    } else {
      await ctx.db.insert('paymentSettings', { userId, ...data })
    }
  },
})
