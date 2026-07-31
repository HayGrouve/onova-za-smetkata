import { describe, expect, it } from 'vitest'
import {
  FREE_BILLS_PER_MONTH,
  FREE_FRIEND_GROUPS,
  FREE_OCR_PER_MONTH,
  getEffectiveTier,
  getFriendGroupLimit,
  getMonthlyBillLimit,
  getMonthlyOcrLimit,
} from './hostTier'
import type { UserBillingFields } from './hostTier'

const now = Date.UTC(2026, 6, 15, 12, 0, 0)

function user(overrides: Partial<UserBillingFields> = {}): UserBillingFields {
  return {
    clerkPlanSlug: 'free_user',
    subscriptionStatus: undefined,
    currentPeriodEnd: undefined,
    graceUntil: undefined,
    ...overrides,
  }
}

describe('getEffectiveTier', () => {
  it('returns free for default free_user plan', () => {
    expect(getEffectiveTier(user(), now)).toBe('free')
  })

  it('returns pro for active pro subscription', () => {
    expect(
      getEffectiveTier(
        user({ clerkPlanSlug: 'pro', subscriptionStatus: 'active' }),
        now,
      ),
    ).toBe('pro')
  })

  it('returns pro for canceled pro until period end', () => {
    expect(
      getEffectiveTier(
        user({
          clerkPlanSlug: 'pro',
          subscriptionStatus: 'canceled',
          currentPeriodEnd: now + 86_400_000,
        }),
        now,
      ),
    ).toBe('pro')
  })

  it('returns free for canceled pro after period end', () => {
    expect(
      getEffectiveTier(
        user({
          clerkPlanSlug: 'pro',
          subscriptionStatus: 'canceled',
          currentPeriodEnd: now - 1,
        }),
        now,
      ),
    ).toBe('free')
  })

  it('returns pro during past_due grace', () => {
    expect(
      getEffectiveTier(
        user({
          clerkPlanSlug: 'pro',
          subscriptionStatus: 'past_due',
          graceUntil: now + 86_400_000,
        }),
        now,
      ),
    ).toBe('pro')
  })

  it('returns free when past_due grace expired', () => {
    expect(
      getEffectiveTier(
        user({
          clerkPlanSlug: 'pro',
          subscriptionStatus: 'past_due',
          graceUntil: now - 1,
        }),
        now,
      ),
    ).toBe('free')
  })
})

describe('tier limits', () => {
  it('free tier has monthly caps', () => {
    expect(getMonthlyBillLimit('free')).toBe(FREE_BILLS_PER_MONTH)
    expect(getMonthlyOcrLimit('free')).toBe(FREE_OCR_PER_MONTH)
    expect(getFriendGroupLimit('free')).toBe(FREE_FRIEND_GROUPS)
  })

  it('pro tier has unlimited bills and OCR', () => {
    expect(getMonthlyBillLimit('pro')).toBeNull()
    expect(getMonthlyOcrLimit('pro')).toBeNull()
    expect(getFriendGroupLimit('pro')).toBe(50)
  })
})
