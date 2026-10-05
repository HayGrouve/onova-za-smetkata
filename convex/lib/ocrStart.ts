import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  assertOcrStartQuota,
  formatUsageMonthKey,
  incrementUsageCount,
  usageCounterKey,
} from './hostTier'
import { assertRateLimit } from './rateLimit'

const OCR_SCANS_PER_HOST_PER_HOUR = 20

/**
 * Every receipt scan a Host starts, on a bill or a quick bill, spends one
 * Gemini call: the monthly OCR quota and an hourly cap apply to both.
 */
export async function assertHostMayStartOcr(
  ctx: MutationCtx,
  owner: Doc<'users'>,
  nowMs: number,
): Promise<void> {
  await assertOcrStartQuota(ctx, owner, owner._id, nowMs)
  // Bills are free to create and quick bills are not bills at all, so a
  // per-bill cap alone does not bound Gemini spend while every Host has Pro
  // limits.
  await assertRateLimit(
    ctx,
    `ocr:user:${owner._id}`,
    OCR_SCANS_PER_HOST_PER_HOUR,
    3_600_000,
  )
}

export async function recordOcrStart(
  ctx: MutationCtx,
  ownerId: Id<'users'>,
  nowMs: number,
): Promise<void> {
  await incrementUsageCount(
    ctx,
    usageCounterKey(ownerId, 'ocr', formatUsageMonthKey(nowMs)),
    nowMs,
  )
}
