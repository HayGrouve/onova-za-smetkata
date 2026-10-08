import { httpRouter } from 'convex/server'
import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import { getStripeWebhookSecret } from './lib/billingEnv'
import { parseClerkEvent, verifyClerkWebhook } from './lib/clerkWebhook'
import {
  isSubscriptionSyncEvent,
  parseStripeEvent,
  verifyStripeSignature,
} from './lib/stripeWebhook'

const http = httpRouter()

/**
 * Stripe webhooks for Host Pro. The event only says *which* customer changed;
 * `billingStripe.syncCustomer` re-fetches the subscription, so retries and
 * out-of-order deliveries cannot leave a stale mirror.
 */
http.route({
  path: '/stripe/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = getStripeWebhookSecret()
    if (!secret) {
      return new Response('Stripe webhooks are not configured', { status: 503 })
    }

    const payload = await request.text()
    const verified = await verifyStripeSignature({
      payload,
      header: request.headers.get('stripe-signature'),
      secret,
      nowMs: Date.now(),
    })
    if (!verified) return new Response('Invalid signature', { status: 400 })

    const event = parseStripeEvent(payload)
    if (!event) return new Response('Malformed event', { status: 400 })

    if (isSubscriptionSyncEvent(event.type) && event.customerId) {
      await ctx.runMutation(internal.billing.recordStripeEvent, {
        eventId: event.id,
        customerId: event.customerId,
      })
    }
    return new Response(null, { status: 200 })
  }),
})

/**
 * Clerk webhooks (Svix). A Host who deletes their Clerk account
 * (`user.deleted`) has their bills and settings erased by
 * `accountDeletion.deleteHostData`.
 */
http.route({
  path: '/clerk/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET
    if (!secret) {
      return new Response('Clerk webhooks are not configured', { status: 503 })
    }

    const payload = await request.text()
    const eventId = request.headers.get('svix-id')
    const verified = await verifyClerkWebhook({
      payload,
      headers: {
        id: eventId,
        timestamp: request.headers.get('svix-timestamp'),
        signature: request.headers.get('svix-signature'),
      },
      secret,
      nowMs: Date.now(),
    })
    if (!verified || !eventId) {
      return new Response('Invalid signature', { status: 400 })
    }

    const event = parseClerkEvent(payload)
    if (!event) return new Response('Malformed event', { status: 400 })

    if (event.type === 'user.deleted' && event.userId) {
      await ctx.runMutation(internal.accountDeletion.recordUserDeleted, {
        eventId,
        clerkSubject: event.userId,
      })
    }
    return new Response(null, { status: 200 })
  }),
})

export default http
