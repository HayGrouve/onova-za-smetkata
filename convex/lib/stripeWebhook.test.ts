import Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import {
  isSubscriptionSyncEvent,
  parseStripeEvent,
  verifyStripeSignature,
} from './stripeWebhook'

const secret = 'whsec_test_secret'
const payload = JSON.stringify({
  id: 'evt_1',
  type: 'customer.subscription.updated',
  data: { object: { id: 'sub_1', customer: 'cus_1' } },
})
const signedAt = 1_790_000_000

/** Signs like Stripe does, so the check is tested against the real scheme. */
function stripeHeader(body: string, options: { secret?: string } = {}) {
  return new Stripe('sk_test_unused').webhooks.generateTestHeaderString({
    payload: body,
    secret: options.secret ?? secret,
    timestamp: signedAt,
  })
}

describe('verifyStripeSignature', () => {
  const nowMs = signedAt * 1000

  it('accepts a body signed by Stripe with the endpoint secret', async () => {
    const header = stripeHeader(payload)
    expect(
      await verifyStripeSignature({ payload, header, secret, nowMs }),
    ).toBe(true)
  })

  it('rejects a changed body, another secret, or no header', async () => {
    const header = stripeHeader(payload)
    const tampered = payload.replace('cus_1', 'cus_2')
    expect(
      await verifyStripeSignature({ payload: tampered, header, secret, nowMs }),
    ).toBe(false)
    expect(
      await verifyStripeSignature({
        payload,
        header: stripeHeader(payload, { secret: 'whsec_other' }),
        secret,
        nowMs,
      }),
    ).toBe(false)
    expect(
      await verifyStripeSignature({ payload, header: null, secret, nowMs }),
    ).toBe(false)
  })

  it('rejects a replay more than five minutes old', async () => {
    const header = stripeHeader(payload)
    expect(
      await verifyStripeSignature({
        payload,
        header,
        secret,
        nowMs: nowMs + 301_000,
      }),
    ).toBe(false)
  })

  it('accepts any matching v1 signature while the secret is rolled', async () => {
    const valid = stripeHeader(payload)
    const header = `${valid},v1=${'0'.repeat(64)}`
    expect(
      await verifyStripeSignature({ payload, header, secret, nowMs }),
    ).toBe(true)
  })
})

describe('parseStripeEvent', () => {
  it('reads the customer from the event object', () => {
    expect(parseStripeEvent(payload)).toEqual({
      id: 'evt_1',
      type: 'customer.subscription.updated',
      customerId: 'cus_1',
    })
  })

  it('reads an expanded customer and tolerates none', () => {
    const expanded = JSON.stringify({
      id: 'evt_2',
      type: 'checkout.session.completed',
      data: { object: { customer: { id: 'cus_9' } } },
    })
    expect(parseStripeEvent(expanded)?.customerId).toBe('cus_9')
    const none = JSON.stringify({
      id: 'evt_3',
      type: 'product.created',
      data: { object: {} },
    })
    expect(parseStripeEvent(none)?.customerId).toBeNull()
  })

  it('rejects bodies that are not events', () => {
    expect(parseStripeEvent('not json')).toBeNull()
    expect(parseStripeEvent('{"type":"x"}')).toBeNull()
  })
})

describe('isSubscriptionSyncEvent', () => {
  it('syncs on subscription and invoice outcomes only', () => {
    expect(isSubscriptionSyncEvent('invoice.payment_failed')).toBe(true)
    expect(isSubscriptionSyncEvent('customer.subscription.deleted')).toBe(true)
    expect(isSubscriptionSyncEvent('product.updated')).toBe(false)
  })
})
