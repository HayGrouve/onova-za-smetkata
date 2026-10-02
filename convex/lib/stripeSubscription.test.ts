import { describe, expect, it } from 'vitest'
import { getEffectiveTier, PAST_DUE_GRACE_MS } from './hostTier'
import {
  billingFieldsFromSubscription,
  pickCurrentSubscription,
  toSubscriptionSnapshot,
} from './stripeSubscription'
import type {
  StripeSubscriptionLike,
  SubscriptionSnapshot,
} from './stripeSubscription'

const now = Date.UTC(2026, 9, 2, 12, 0, 0)
const nowSeconds = now / 1000
const DAY = 86_400

function stripeSubscription(
  overrides: Partial<StripeSubscriptionLike> = {},
): StripeSubscriptionLike {
  return {
    id: 'sub_1',
    status: 'active',
    created: nowSeconds - 10 * DAY,
    cancel_at_period_end: false,
    ended_at: null,
    items: { data: [{ current_period_end: nowSeconds + 20 * DAY }] },
    ...overrides,
  }
}

function snapshot(overrides: Partial<StripeSubscriptionLike> = {}) {
  return toSubscriptionSnapshot(stripeSubscription(overrides))
}

const noHistory = { subscriptionStatus: undefined, graceUntil: undefined }

function tierAfterSync(
  subscription: SubscriptionSnapshot | null,
  at = now,
  previous = noHistory,
) {
  return getEffectiveTier(
    billingFieldsFromSubscription(subscription, previous, now),
    at,
  )
}

describe('pickCurrentSubscription', () => {
  it('prefers a paying subscription over a newer ended one', () => {
    const live = stripeSubscription({ id: 'sub_live' })
    const ended = stripeSubscription({
      id: 'sub_old',
      status: 'canceled',
      created: nowSeconds,
    })
    expect(pickCurrentSubscription([ended, live])?.id).toBe('sub_live')
  })

  it('takes the newest among equals, and nothing from nothing', () => {
    const older = stripeSubscription({ id: 'a', status: 'canceled' })
    const newer = stripeSubscription({
      id: 'b',
      status: 'canceled',
      created: nowSeconds,
    })
    expect(pickCurrentSubscription([older, newer])?.id).toBe('b')
    expect(pickCurrentSubscription([])).toBeNull()
  })
})

describe('Host Pro from a Stripe subscription', () => {
  it('an active or trialing subscription is Pro until its period ends', () => {
    expect(tierAfterSync(snapshot())).toBe('pro')
    expect(tierAfterSync(snapshot({ status: 'trialing' }))).toBe('pro')
  })

  it('a cancellation at period end keeps Pro, then the ended subscription is Free', () => {
    const cancelling = billingFieldsFromSubscription(
      snapshot({ cancel_at_period_end: true }),
      noHistory,
      now,
    )
    expect(cancelling.cancelAtPeriodEnd).toBe(true)
    expect(getEffectiveTier(cancelling, now)).toBe('pro')

    const ended = snapshot({ status: 'canceled', ended_at: nowSeconds - 60 })
    expect(tierAfterSync(ended)).toBe('free')
  })

  it('an immediately cancelled subscription loses Pro despite a future period end', () => {
    const refunded = snapshot({ status: 'canceled', ended_at: nowSeconds })
    expect(tierAfterSync(refunded, now + 1)).toBe('free')
  })

  it('a failed renewal keeps Pro for the grace week, counted from the first failure', () => {
    const pastDue = snapshot({ status: 'past_due' })
    const first = billingFieldsFromSubscription(pastDue, noHistory, now)
    expect(first.graceUntil).toBe(now + PAST_DUE_GRACE_MS)
    expect(getEffectiveTier(first, now + PAST_DUE_GRACE_MS - 1)).toBe('pro')
    expect(getEffectiveTier(first, now + PAST_DUE_GRACE_MS + 1)).toBe('free')

    const later = billingFieldsFromSubscription(
      pastDue,
      { subscriptionStatus: 'past_due', graceUntil: first.graceUntil },
      now + 3 * DAY * 1000,
    )
    expect(later.graceUntil).toBe(first.graceUntil)
  })

  it('a payment still pending, paused or unpaid is Free', () => {
    for (const status of ['incomplete', 'paused', 'unpaid']) {
      expect(tierAfterSync(snapshot({ status }))).toBe('free')
    }
  })

  it('no subscription clears the mirror back to Free', () => {
    expect(billingFieldsFromSubscription(null, noHistory, now)).toEqual({
      clerkPlanSlug: 'free_user',
      subscriptionStatus: undefined,
      currentPeriodEnd: undefined,
      graceUntil: undefined,
      cancelAtPeriodEnd: undefined,
      stripeSubscriptionId: undefined,
    })
  })
})
