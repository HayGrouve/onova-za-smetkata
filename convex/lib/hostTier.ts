import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  isQuotaErrorCode,
  SUBSCRIPTION_MESSAGES,
} from '../../shared/subscription-messages'
import type { QuotaErrorCode } from '../../shared/subscription-messages'

export const FREE_BILLS_PER_MONTH = 5
export const FREE_OCR_PER_MONTH = 5
export const FREE_FRIEND_GROUPS = 1
export const PRO_FRIEND_GROUPS = 50
export const PAST_DUE_GRACE_MS = 7 * 24 * 60 * 60 * 1000

/** Calendar month keys use UTC (yyyy-mm). */
export const USAGE_TIMEZONE = 'UTC' as const

export type HostTier = 'free' | 'pro'

export type UserBillingFields = Pick<
  Doc<'users'>,
  'clerkPlanSlug' | 'subscriptionStatus' | 'currentPeriodEnd' | 'graceUntil'
>

export function getEffectiveTier(
  user: UserBillingFields,
  nowMs: number,
): HostTier {
  if (
    user.clerkPlanSlug === 'pro' &&
    (user.subscriptionStatus === 'active' ||
      (user.subscriptionStatus === 'canceled' &&
        user.currentPeriodEnd !== undefined &&
        nowMs < user.currentPeriodEnd))
  ) {
    return 'pro'
  }

  if (
    user.subscriptionStatus === 'past_due' &&
    user.graceUntil !== undefined &&
    nowMs < user.graceUntil
  ) {
    return 'pro'
  }

  return 'free'
}

export function getMonthlyBillLimit(tier: HostTier): number | null {
  return tier === 'pro' ? null : FREE_BILLS_PER_MONTH
}

export function getMonthlyOcrLimit(tier: HostTier): number | null {
  return tier === 'pro' ? null : FREE_OCR_PER_MONTH
}

export function getFriendGroupLimit(tier: HostTier): number {
  return tier === 'pro' ? PRO_FRIEND_GROUPS : FREE_FRIEND_GROUPS
}

export function formatUsageMonthKey(nowMs: number): string {
  const date = new Date(nowMs)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function usageCounterKey(
  userId: Id<'users'>,
  kind: 'bills' | 'ocr',
  monthKey: string,
): string {
  return `usage:${userId}:${kind}:${monthKey}`
}

export async function getUsageCount(
  ctx: QueryCtx | MutationCtx,
  key: string,
): Promise<number> {
  const bucket = await ctx.db
    .query('rateLimitBuckets')
    .withIndex('by_key', (q) => q.eq('key', key))
    .first()
  return bucket?.count ?? 0
}

export async function incrementUsageCount(
  ctx: MutationCtx,
  key: string,
  nowMs: number,
): Promise<number> {
  const existing = await ctx.db
    .query('rateLimitBuckets')
    .withIndex('by_key', (q) => q.eq('key', key))
    .first()

  if (existing) {
    const next = existing.count + 1
    await ctx.db.patch(existing._id, { count: next })
    return next
  }

  await ctx.db.insert('rateLimitBuckets', {
    key,
    windowStart: nowMs,
    count: 1,
  })
  return 1
}

export function throwQuotaError(code: QuotaErrorCode): never {
  throw new ConvexError({
    code,
    message: SUBSCRIPTION_MESSAGES[code],
  })
}

export async function assertBillCreateQuota(
  ctx: MutationCtx,
  user: Doc<'users'>,
  userId: Id<'users'>,
  nowMs: number,
): Promise<void> {
  const tier = getEffectiveTier(user, nowMs)
  const limit = getMonthlyBillLimit(tier)
  if (limit === null) return

  const monthKey = formatUsageMonthKey(nowMs)
  const used = await getUsageCount(
    ctx,
    usageCounterKey(userId, 'bills', monthKey),
  )
  if (used >= limit) {
    throwQuotaError('QUOTA_BILLS')
  }
}

export async function assertOcrStartQuota(
  ctx: MutationCtx,
  user: Doc<'users'>,
  userId: Id<'users'>,
  nowMs: number,
): Promise<void> {
  const tier = getEffectiveTier(user, nowMs)
  const limit = getMonthlyOcrLimit(tier)
  if (limit === null) return

  const monthKey = formatUsageMonthKey(nowMs)
  const used = await getUsageCount(
    ctx,
    usageCounterKey(userId, 'ocr', monthKey),
  )
  if (used >= limit) {
    throwQuotaError('QUOTA_OCR')
  }
}

export async function assertFriendGroupCreateQuota(
  user: Doc<'users'>,
  existingGroupCount: number,
  nowMs: number,
): Promise<void> {
  const tier = getEffectiveTier(user, nowMs)
  const limit = getFriendGroupLimit(tier)
  if (existingGroupCount >= limit) {
    throwQuotaError('QUOTA_GROUPS')
  }
}

export function parseQuotaErrorData(
  data: unknown,
): { code: QuotaErrorCode; message: string } | null {
  if (!data || typeof data !== 'object') return null
  const code = Reflect.get(data, 'code')
  const message = Reflect.get(data, 'message')
  if (!isQuotaErrorCode(code)) return null
  if (typeof message !== 'string' || !message.trim()) return null
  return { code, message }
}
