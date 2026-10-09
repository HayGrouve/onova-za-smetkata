'use node'

import Stripe from 'stripe'
import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import { action, internalAction } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import {
  requireStripeCheckoutConfig,
  requireStripeSecretKey,
} from './lib/billingEnv'
import {
  pickCurrentSubscription,
  toSubscriptionSnapshot,
} from './lib/stripeSubscription'

/** Uses the API version this SDK release is pinned to (Managed Payments needs ≥ 2025-03-31). */
function stripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey)
}

/** Where Checkout and the Customer Portal send the Host back to. */
const SUBSCRIPTION_PAGE_PATH = '/user-profile/subscription'

async function syncCustomerSubscriptions(
  ctx: ActionCtx,
  stripe: Stripe,
  customerId: string,
): Promise<void> {
  const fetchedAt = Date.now()
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 20,
  })
  const current = pickCurrentSubscription(subscriptions.data)
  await ctx.runMutation(internal.billing.applySubscription, {
    stripeCustomerId: customerId,
    subscription: current ? toSubscriptionSnapshot(current) : null,
    fetchedAt,
  })
}

/**
 * Starts a Stripe Managed Payments Checkout for Host Pro. The Host must have
 * agreed to start Pro at once, waiving the 14-day withdrawal right.
 */
export const createCheckoutSession = action({
  args: {
    interval: v.union(v.literal('month'), v.literal('year')),
    withdrawalWaiver: v.literal(true),
  },
  returns: v.object({ url: v.string() }),
  handler: async (ctx, args) => {
    const config = requireStripeCheckoutConfig()
    const host = await ctx.runMutation(internal.billing.beginCheckout, {})
    const stripe = stripeClient(config.secretKey)

    let customerId = host.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          email: host.email,
          name: host.name,
          metadata: { convexUserId: host.userId },
        },
        { idempotencyKey: `host-pro-customer-${host.userId}` },
      )
      customerId = await ctx.runMutation(internal.billing.setStripeCustomerId, {
        userId: host.userId,
        stripeCustomerId: customer.id,
      })
    }

    const returnUrl = `${config.appOrigin}${SUBSCRIPTION_PAGE_PATH}`
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      managed_payments: { enabled: true },
      customer: customerId,
      client_reference_id: host.userId,
      line_items: [{ price: config.priceIds[args.interval], quantity: 1 }],
      locale: 'bg',
      metadata: { convexUserId: host.userId },
      subscription_data: {
        metadata: {
          convexUserId: host.userId,
          withdrawalWaiverAt: new Date().toISOString(),
        },
      },
      success_url: `${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?checkout=cancelled`,
    })
    if (!session.url) throw new Error('Stripe returned no Checkout URL')
    return { url: session.url }
  },
})

/** Opens the Stripe Customer Portal (cancel, change plan, card, invoices). */
export const createPortalSession = action({
  args: {},
  returns: v.object({ url: v.string() }),
  handler: async (ctx) => {
    const config = requireStripeCheckoutConfig()
    const account = await ctx.runQuery(internal.billing.billingAccount, {})
    if (!account.stripeCustomerId) {
      throw new ConvexError({
        code: 'NO_BILLING_ACCOUNT',
        message: 'Все още нямате абонамент.',
      })
    }
    const session = await stripeClient(
      config.secretKey,
    ).billingPortal.sessions.create({
      customer: account.stripeCustomerId,
      locale: 'bg',
      return_url: `${config.appOrigin}${SUBSCRIPTION_PAGE_PATH}`,
    })
    return { url: session.url }
  },
})

/**
 * Pulls the subscription right after Checkout returns, so Pro does not wait
 * for the webhook. Only the Host who started the session may sync it.
 */
export const syncAfterCheckout = action({
  args: { sessionId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const account = await ctx.runMutation(
      internal.billing.beginCheckoutSync,
      {},
    )
    const stripe = stripeClient(requireStripeSecretKey())
    const session = await stripe.checkout.sessions.retrieve(args.sessionId)
    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : (session.customer?.id ?? null)
    if (
      session.client_reference_id !== account.userId ||
      !customerId ||
      customerId !== account.stripeCustomerId
    ) {
      throw new ConvexError('Плащането не е намерено.')
    }
    await syncCustomerSubscriptions(ctx, stripe, customerId)
    return null
  },
})

/**
 * Waits before each retry of a failed webhook sync. The event is already
 * recorded as handled, so Stripe's own redelivery is dropped as a repeat.
 */
const SYNC_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000]

/** Webhook-triggered re-fetch of a customer's subscriptions. */
export const syncCustomer = internalAction({
  args: { customerId: v.string(), attempt: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const attempt = args.attempt ?? 0
    try {
      const stripe = stripeClient(requireStripeSecretKey())
      await syncCustomerSubscriptions(ctx, stripe, args.customerId)
    } catch (error) {
      const delayMs = SYNC_RETRY_DELAYS_MS.at(attempt)
      if (delayMs !== undefined) {
        await ctx.scheduler.runAfter(
          delayMs,
          internal.billingStripe.syncCustomer,
          {
            customerId: args.customerId,
            attempt: attempt + 1,
          },
        )
      }
      throw error
    }
    return null
  },
})

/** The Host deleted their account: end every subscription that can still bill. */
export const cancelCustomerSubscriptions = internalAction({
  args: { customerId: v.string() },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const stripe = stripeClient(requireStripeSecretKey())
    const subscriptions = await stripe.subscriptions.list({
      customer: args.customerId,
      status: 'all',
      limit: 20,
    })
    for (const subscription of subscriptions.data) {
      if (
        subscription.status === 'canceled' ||
        subscription.status === 'incomplete_expired'
      ) {
        continue
      }
      await stripe.subscriptions.cancel(subscription.id)
    }
    return null
  },
})
