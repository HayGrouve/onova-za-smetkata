import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { HOST_ONBOARDING_VERSION } from '../../shared/host-onboarding'

export async function getHostOnboardingForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<Doc<'hostOnboarding'> | null> {
  return await ctx.db
    .query('hostOnboarding')
    .withIndex('by_userId', (q) => q.eq('userId', userId))
    .first()
}

export async function ensureHostOnboarding(
  ctx: MutationCtx,
  userId: Id<'users'>,
): Promise<Doc<'hostOnboarding'>> {
  const existing = await getHostOnboardingForUser(ctx, userId)
  if (existing) return existing

  const now = Date.now()
  const id = await ctx.db.insert('hostOnboarding', {
    userId,
    version: HOST_ONBOARDING_VERSION,
    lifecycle: 'notStarted',
    paymentCheckpointDismissed: false,
    updatedAt: now,
  })
  const created = await ctx.db.get(id)
  if (!created) {
    throw new Error('Failed to create host onboarding record')
  }
  return created
}

export async function countOwnedBills(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<number> {
  const bills = await ctx.db
    .query('bills')
    .withIndex('by_ownerId_updatedAt', (q) => q.eq('ownerId', userId))
    .collect()
  return bills.length
}

export function tryMarkOnboardingComplete(
  record: Doc<'hostOnboarding'>,
): Partial<Doc<'hostOnboarding'>> | null {
  if (record.lifecycle !== 'active') return null
  if (record.preparedAt === undefined || record.sharedAt === undefined) {
    return null
  }
  if (record.completedAt !== undefined) return null
  return {
    lifecycle: 'completed',
    completedAt: Date.now(),
    updatedAt: Date.now(),
  }
}
