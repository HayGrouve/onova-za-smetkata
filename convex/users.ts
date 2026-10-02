import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth, getOptionalAuthUserId } from './lib/auth'
import {
  getEffectiveTier,
  getFriendGroupLimit,
  getMonthlyBillLimit,
  getMonthlyOcrLimit,
  getUsageCount,
  formatUsageMonthKey,
  usageCounterKey,
} from './lib/hostTier'

export const viewer = query({
  args: {
    nowMs: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getOptionalAuthUserId(ctx)
    if (userId === null) return null

    const user = await ctx.db.get(userId)
    if (!user) return null

    const now = args.nowMs
    const tier = getEffectiveTier(user, now)
    const monthKey = formatUsageMonthKey(now)

    const billsUsedThisMonth = await getUsageCount(
      ctx,
      usageCounterKey(userId, 'bills', monthKey),
    )
    const ocrUsedThisMonth = await getUsageCount(
      ctx,
      usageCounterKey(userId, 'ocr', monthKey),
    )

    const friendGroups = await ctx.db
      .query('friendGroups')
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()

    const name = user.name?.trim()
    const email = user.email?.trim()
    const label = name || email || 'Потребител'
    const username = user.username?.trim() || undefined

    return {
      label,
      name,
      email,
      image: user.image,
      username,
      tier,
      billsUsedThisMonth,
      billsLimit: getMonthlyBillLimit(tier),
      ocrUsedThisMonth,
      ocrLimit: getMonthlyOcrLimit(tier),
      friendGroupCount: friendGroups.length,
      friendGroupLimit: getFriendGroupLimit(tier),
      subscriptionStatus: user.subscriptionStatus,
      graceUntil: user.graceUntil,
    }
  },
})

export const ensureCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    return await requireAuth(ctx)
  },
})
