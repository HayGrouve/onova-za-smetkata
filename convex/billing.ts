import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation, internalQuery, query } from './_generated/server'
import { getOptionalAuthUserId, requireAuth } from './lib/auth'
import { isBillingEnabled } from './lib/billingEnv'
import { getEntitledTier } from './lib/hostTier'
import { assertRateLimit } from './lib/rateLimit'
import {
  billingFieldsFromSubscription,
  isLiveSubscriptionStatus,
  subscriptionSnapshotValidator,
} from './lib/stripeSubscription'

const CHECKOUT_RATE_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 }

/** Host Pro state for the signed-in Host; `enabled` mirrors the billing switch. */
export const status = query({
  args: { nowMs: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      enabled: v.boolean(),
      tier: v.union(v.literal('free'), v.literal('pro')),
      subscriptionStatus: v.optional(v.string()),
      currentPeriodEnd: v.optional(v.number()),
      cancelAtPeriodEnd: v.boolean(),
      graceUntil: v.optional(v.number()),
      hasBillingAccount: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getOptionalAuthUserId(ctx)
    if (userId === null) return null
    const user = await ctx.db.get('users', userId)
    if (!user) return null

    return {
      enabled: isBillingEnabled(),
      tier: getEntitledTier(user, args.nowMs),
      subscriptionStatus: user.subscriptionStatus,
      currentPeriodEnd: user.currentPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd ?? false,
      graceUntil: user.graceUntil,
      hasBillingAccount: user.stripeCustomerId !== undefined,
    }
  },
})

/**
 * Checkout preflight for `billingStripe.createCheckoutSession`: the signed-in
 * Host, rate limited, who must not already have a live subscription.
 */
export const beginCheckout = internalMutation({
  args: {},
  returns: v.object({
    userId: v.id('users'),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    await assertRateLimit(
      ctx,
      `checkout:${userId}`,
      CHECKOUT_RATE_LIMIT.max,
      CHECKOUT_RATE_LIMIT.windowMs,
    )
    const user = await ctx.db.get('users', userId)
    if (!user) throw new ConvexError('Изисква се вход')
    if (isLiveSubscriptionStatus(user.subscriptionStatus)) {
      throw new ConvexError({
        code: 'ALREADY_SUBSCRIBED',
        message: 'Вече имате Pro абонамент.',
      })
    }
    return {
      userId,
      email: user.email,
      name: user.name,
      stripeCustomerId: user.stripeCustomerId,
    }
  },
})

/** The signed-in Host's Stripe customer and Convex id, for portal and post-checkout sync. */
export const billingAccount = internalQuery({
  args: {},
  returns: v.object({
    userId: v.id('users'),
    stripeCustomerId: v.optional(v.string()),
  }),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    const user = await ctx.db.get('users', userId)
    return { userId, stripeCustomerId: user?.stripeCustomerId }
  },
})

/** Links a Stripe customer to the Host once; returns the customer to use. */
export const setStripeCustomerId = internalMutation({
  args: { userId: v.id('users'), stripeCustomerId: v.string() },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get('users', args.userId)
    if (!user) throw new Error(`User ${args.userId} not found`)
    if (user.stripeCustomerId) return user.stripeCustomerId
    await ctx.db.patch('users', args.userId, {
      stripeCustomerId: args.stripeCustomerId,
    })
    return args.stripeCustomerId
  },
})

/**
 * Records a verified webhook event once and schedules a re-fetch of the
 * customer's subscriptions. Returns false for a repeated delivery.
 */
export const recordStripeEvent = internalMutation({
  args: { eventId: v.string(), customerId: v.string() },
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
    await ctx.scheduler.runAfter(0, internal.billingStripe.syncCustomer, {
      customerId: args.customerId,
    })
    return true
  },
})

/** Writes the Host Pro mirror from a subscription fetched from Stripe at `fetchedAt`. */
export const applySubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    subscription: v.union(v.null(), subscriptionSnapshotValidator),
    fetchedAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_stripeCustomerId', (q) =>
        q.eq('stripeCustomerId', args.stripeCustomerId),
      )
      .unique()
    if (!user) {
      console.warn(`No Host for Stripe customer ${args.stripeCustomerId}`)
      return null
    }
    if (
      user.billingSyncedAt !== undefined &&
      user.billingSyncedAt > args.fetchedAt
    ) {
      return null
    }

    await ctx.db.patch('users', user._id, {
      ...billingFieldsFromSubscription(args.subscription, user, Date.now()),
      billingSyncedAt: args.fetchedAt,
    })
    return null
  },
})
