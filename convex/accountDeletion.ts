import { v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import { internalMutation, mutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { requireAuth } from './lib/auth'
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
    if (user) await startErasingHost(ctx, user)
    return true
  },
})

/**
 * Изтрий данните: the signed in Host wipes everything Сметката holds about
 * them. The Акаунт stays and they stay signed in. The `users` row goes at
 * once, so their next call makes a fresh row (a brand new Host) whose bills
 * the eraser never touches; the rest is erased in the background.
 */
export const deleteMyData = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const user = await ctx.db.get(userId)
    if (user) await startErasingHost(ctx, user)
    return null
  },
})

/**
 * Starts erasing one Host by `users` id. Kept by this name as the cutover
 * runbook's fallback (`npx convex run accountDeletion:deleteHostData`). When
 * the row is already gone, erases whatever is left under that id.
 */
export const deleteHostData = internalMutation({
  args: { userId: v.id('users') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (user) {
      await startErasingHost(ctx, user)
    } else {
      await ctx.scheduler.runAfter(0, internal.accountDeletion.eraseHostData, {
        userId: args.userId,
      })
    }
    return null
  },
})

/**
 * The one way a Host is erased (Изтрий данните and `user.deleted`): note a
 * live subscription, delete the `users` row now, erase the rest in the
 * background.
 */
async function startErasingHost(ctx: MutationCtx, user: Doc<'users'>) {
  const stripeSubscriptionId =
    user.stripeSubscriptionId &&
    isLiveSubscriptionStatus(user.subscriptionStatus)
      ? user.stripeSubscriptionId
      : undefined
  await ctx.db.delete(user._id)
  await ctx.scheduler.runAfter(0, internal.accountDeletion.eraseHostData, {
    userId: user._id,
    ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
  })
}

/**
 * Erases what a deleted `users` row left behind: a bill (with its seats,
 * lines, payments, Guest sessions and receipt photo) per run so a big archive
 * stays inside transaction limits, then the Host's own rows, then cancels the
 * subscription noted when the row was deleted (at once, no refund).
 * Reschedules itself until done. Needs no `users` row.
 */
export const eraseHostData = internalMutation({
  args: {
    userId: v.id('users'),
    stripeSubscriptionId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bill = await ctx.db
      .query('bills')
      .withIndex('by_ownerId_updatedAt', (q) => q.eq('ownerId', args.userId))
      .first()
    if (bill) {
      await deleteBillWithRelations(ctx, bill)
      await ctx.scheduler.runAfter(
        0,
        internal.accountDeletion.eraseHostData,
        args,
      )
      return null
    }

    await deleteHostRows(ctx, args.userId)

    // Stop charging a Host who no longer exists. The webhook that follows
    // finds no user for the customer and is ignored.
    if (args.stripeSubscriptionId) {
      await ctx.scheduler.runAfter(
        0,
        internal.billingStripe.cancelSubscription,
        { subscriptionId: args.stripeSubscriptionId },
      )
    }
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
