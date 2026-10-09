// @vitest-environment edge-runtime
import Stripe from 'stripe'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from './_generated/api'
import { HOST_IDENTITY, setupConvex } from './test.setup'
import type { TestConvex } from './test.setup'

const WEBHOOK_SECRET = 'whsec_test_secret'
const DAY_MS = 86_400_000

afterEach(() => {
  vi.unstubAllEnvs()
})

async function hostWithStripeCustomer(t: TestConvex, customerId = 'cus_1') {
  const host = t.withIdentity(HOST_IDENTITY)
  await host.mutation(api.users.ensureCurrent, {})
  await t.run(async (ctx) => {
    const user = await ctx.db
      .query('users')
      .withIndex('by_clerkSubject', (q) =>
        q.eq('clerkSubject', HOST_IDENTITY.subject),
      )
      .unique()
    if (!user) throw new Error('Host was not created')
    await ctx.db.patch('users', user._id, { stripeCustomerId: customerId })
  })
  return host
}

function subscription(status: string, overrides = {}) {
  const now = Date.now()
  return {
    id: 'sub_1',
    status,
    currentPeriodEnd: now + 30 * DAY_MS,
    cancelAtPeriodEnd: false,
    endedAt: null,
    ...overrides,
  }
}

function deliver(t: TestConvex, event: object, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify(event)
  const signature = new Stripe(
    'sk_test_unused',
  ).webhooks.generateTestHeaderString({ payload, secret })
  return t.fetch('/stripe/webhook', {
    method: 'POST',
    body: payload,
    headers: { 'stripe-signature': signature },
  })
}

const subscriptionUpdated = {
  id: 'evt_1',
  type: 'customer.subscription.updated',
  data: { object: { id: 'sub_1', customer: 'cus_1' } },
}

describe('Stripe webhook', () => {
  it('is closed until a signing secret is configured', async () => {
    const t = setupConvex()
    const response = await deliver(t, subscriptionUpdated)
    expect(response.status).toBe(503)
  })

  it('rejects deliveries not signed with the endpoint secret', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    const t = setupConvex()
    const response = await deliver(t, subscriptionUpdated, 'whsec_forged')
    expect(response.status).toBe(400)
    expect(
      await t.run((ctx) => ctx.db.query('processedWebhookEvents').collect()),
    ).toHaveLength(0)
  })

  it('handles a repeated delivery once and schedules one subscription re-fetch', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    const t = setupConvex()

    expect((await deliver(t, subscriptionUpdated)).status).toBe(200)
    expect((await deliver(t, subscriptionUpdated)).status).toBe(200)

    const { events, scheduled } = await t.run(async (ctx) => ({
      events: await ctx.db.query('processedWebhookEvents').collect(),
      scheduled: await ctx.db.system.query('_scheduled_functions').collect(),
    }))
    expect(events.map((event) => event.eventId)).toEqual(['evt_1'])
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].args).toEqual([{ customerId: 'cus_1' }])
  })

  it('ignores events that cannot change a subscription', async () => {
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', WEBHOOK_SECRET)
    const t = setupConvex()
    const response = await deliver(t, {
      id: 'evt_2',
      type: 'product.updated',
      data: { object: { id: 'prod_1' } },
    })
    expect(response.status).toBe(200)
    expect(
      await t.run((ctx) => ctx.db.query('processedWebhookEvents').collect()),
    ).toHaveLength(0)
  })
})

describe('Host Pro from Stripe', () => {
  it('a synced subscription makes the Host Pro once billing is on', async () => {
    vi.stubEnv('BILLING_ENABLED', 'true')
    const t = setupConvex()
    const host = await hostWithStripeCustomer(t)
    const nowMs = Date.now()

    expect(await host.query(api.billing.status, { nowMs })).toMatchObject({
      enabled: true,
      tier: 'free',
      hasBillingAccount: true,
    })

    await t.mutation(internal.billing.applySubscription, {
      stripeCustomerId: 'cus_1',
      subscription: subscription('active', { cancelAtPeriodEnd: true }),
      fetchedAt: nowMs,
    })
    expect(await host.query(api.billing.status, { nowMs })).toMatchObject({
      tier: 'pro',
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: true,
    })
  })

  it('a sync fetched before the stored one does not overwrite it', async () => {
    vi.stubEnv('BILLING_ENABLED', 'true')
    const t = setupConvex()
    const host = await hostWithStripeCustomer(t)
    const nowMs = Date.now()

    await t.mutation(internal.billing.applySubscription, {
      stripeCustomerId: 'cus_1',
      subscription: subscription('canceled', { endedAt: nowMs - 1000 }),
      fetchedAt: nowMs,
    })
    await t.mutation(internal.billing.applySubscription, {
      stripeCustomerId: 'cus_1',
      subscription: subscription('active'),
      fetchedAt: nowMs - 5000,
    })

    expect(await host.query(api.billing.status, { nowMs })).toMatchObject({
      tier: 'free',
      subscriptionStatus: 'canceled',
    })
  })

  it('while billing is off every Host is Pro for free', async () => {
    const t = setupConvex()
    const host = await hostWithStripeCustomer(t)
    expect(
      await host.query(api.billing.status, { nowMs: Date.now() }),
    ).toMatchObject({ enabled: false, tier: 'pro' })
  })

  it('a Host who already pays cannot start a second checkout', async () => {
    const t = setupConvex()
    await hostWithStripeCustomer(t)
    await t.mutation(internal.billing.applySubscription, {
      stripeCustomerId: 'cus_1',
      subscription: subscription('active'),
      fetchedAt: Date.now(),
    })

    await expect(
      t
        .withIdentity(HOST_IDENTITY)
        .mutation(internal.billing.beginCheckout, {}),
    ).rejects.toMatchObject({ data: { code: 'ALREADY_SUBSCRIBED' } })
  })

  it('a Host cannot sync a Checkout more than ten times an hour', async () => {
    const t = setupConvex()
    const host = await hostWithStripeCustomer(t)
    const sync = () =>
      host.action(api.billingStripe.syncAfterCheckout, { sessionId: 'cs_1' })

    // Without a Stripe key each allowed call fails after the rate limit.
    for (let call = 0; call < 10; call++) {
      await expect(sync()).rejects.toThrow('STRIPE_SECRET_KEY')
    }
    await expect(sync()).rejects.toThrow('Твърде много заявки')
  })
})

describe('a failed webhook sync', () => {
  async function scheduledSyncs(t: TestConvex) {
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query('_scheduled_functions').collect(),
    )
    return scheduled.map((job) => job.args[0] as object)
  }

  it('retries itself with the next attempt number', async () => {
    const t = setupConvex()
    await expect(
      t.action(internal.billingStripe.syncCustomer, { customerId: 'cus_1' }),
    ).rejects.toThrow()
    expect(await scheduledSyncs(t)).toEqual([
      { customerId: 'cus_1', attempt: 1 },
    ])
  })

  it('gives up after the last retry', async () => {
    const t = setupConvex()
    await expect(
      t.action(internal.billingStripe.syncCustomer, {
        customerId: 'cus_1',
        attempt: 4,
      }),
    ).rejects.toThrow()
    expect(await scheduledSyncs(t)).toEqual([])
  })
})
