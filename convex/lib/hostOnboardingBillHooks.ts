import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { getHostOnboardingForUser } from './hostOnboarding'

export async function clearGuidedBillReference(
  ctx: MutationCtx,
  ownerId: Id<'users'>,
  billId: Id<'bills'>,
): Promise<void> {
  const onboarding = await getHostOnboardingForUser(ctx, ownerId)
  if (!onboarding || onboarding.guidedBillId !== billId) return
  if (onboarding.lifecycle !== 'active') return

  await ctx.db.patch(onboarding._id, {
    guidedBillId: undefined,
    preparedAt: undefined,
    updatedAt: Date.now(),
  })
}
