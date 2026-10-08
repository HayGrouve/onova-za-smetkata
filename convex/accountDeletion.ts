import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Id } from './_generated/dataModel'
import { internalMutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { deleteBillWithRelations } from './lib/deleteBill'
import { deleteStoredPhoto } from './lib/receiptStorage'
import { isLiveSubscriptionStatus } from './lib/stripeSubscription'

/** Cleanup drops quick scans after 24 h, every 6 h; nothing older can remain. */
const QUICK_SCAN_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000

/**
 * A Host deleted their Clerk account (verified `user.deleted` webhook).
 * Records the delivery once and starts erasing the Host's data. Returns false
 * for a repeated delivery.
 */
export const recordUserDeleted = internalMutation({
  args: { eventId: v.string(), clerkSubject: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const seen = await ctx.db
      .query('processedWebhookEvents')
      .withIndex('by_eventId', (q) => q.eq('eventId', args.eventId))
      .first()
    if (seen) return false

    await ctx.db.insert('processedWebhookEvents', {
      eventId: args.eventId,
      processedAt: Date.now(),
    })
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkSubject', (q) =>
        q.eq('clerkSubject', args.clerkSubject),
      )
      .unique()
    if (user) {
      await ctx.scheduler.runAfter(0, internal.accountDeletion.deleteHostData, {
        userId: user._id,
      })
    }
    return true
  },
})

/**
 * Erases one Host: a bill (with its seats, lines, payments, Guest sessions and
 * receipt photo) per run so a big archive stays inside transaction limits,
 * then the Host's own rows and finally the user. Reschedules itself until done.
 */
export const deleteHostData = internalMutation({
  args: { userId: v.id('users') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) return null

    const bill = await ctx.db
      .query('bills')
      .withIndex('by_ownerId_updatedAt', (q) => q.eq('ownerId', args.userId))
      .first()
    if (bill) {
      await deleteBillWithRelations(ctx, bill)
      await ctx.scheduler.runAfter(0, internal.accountDeletion.deleteHostData, {
        userId: args.userId,
      })
      return null
    }

    await deleteHostRows(ctx, args.userId)

    // Stop charging a Host who no longer exists. The webhook that follows
    // finds no user for the customer and is ignored.
    if (
      user.stripeCustomerId &&
      isLiveSubscriptionStatus(user.subscriptionStatus)
    ) {
      await ctx.scheduler.runAfter(
        0,
        internal.billingStripe.cancelCustomerSubscriptions,
        { customerId: user.stripeCustomerId },
      )
    }
    await ctx.db.delete(args.userId)
    return null
  },
})

async function deleteHostRows(ctx: MutationCtx, userId: Id<'users'>) {
  for (const table of [
    'paymentSettings',
    'friendGroups',
    'hostOnboarding',
  ] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex('by_userId', (q) => q.eq('userId', userId))
      .collect()
    for (const row of rows) await ctx.db.delete(row._id)
  }

  const usagePrefix = `usage:${userId}:`
  const usageCounters = await ctx.db
    .query('rateLimitBuckets')
    .withIndex('by_key', (q) =>
      q.gte('key', usagePrefix).lt('key', `${usagePrefix}￿`),
    )
    .collect()
  for (const counter of usageCounters) await ctx.db.delete(counter._id)
  for (const key of [
    `upload:${userId}`,
    `upload:quick:${userId}`,
    `ocr:user:${userId}`,
    `checkout:${userId}`,
  ]) {
    const bucket = await ctx.db
      .query('rateLimitBuckets')
      .withIndex('by_key', (q) => q.eq('key', key))
      .first()
    if (bucket) await ctx.db.delete(bucket._id)
  }

  const recentQuickScans = await ctx.db
    .query('quickScans')
    .withIndex('by_createdAt', (q) =>
      q.gte('createdAt', Date.now() - QUICK_SCAN_MAX_AGE_MS),
    )
    .collect()
  for (const scan of recentQuickScans) {
    if (scan.ownerId !== userId) continue
    if (scan.storageId) await deleteStoredPhoto(ctx, scan.storageId)
    await ctx.db.delete(scan._id)
  }
}
