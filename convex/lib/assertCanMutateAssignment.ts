import { ConvexError } from 'convex/values'
import { getAuthUserId } from '@convex-dev/auth/server'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { assertBillOwnedBy } from './bill_ownership'
import { requireGuestSession } from './requireGuestSession'

export async function assertCanMutateAssignment(
  ctx: MutationCtx,
  args: {
    billId: Id<'bills'>
    participantId: Id<'participants'>
    sessionToken?: string
  },
): Promise<void> {
  const userId = await getAuthUserId(ctx)
  if (userId !== null) {
    const bill = await ctx.db.get(args.billId)
    if (bill?.ownerId) {
      assertBillOwnedBy(bill, userId)
      return
    }
  }

  if (!args.sessionToken) {
    throw new ConvexError('Изисква се валидна гост-сесия.')
  }

  await requireGuestSession(ctx, {
    billId: args.billId,
    participantId: args.participantId,
    sessionToken: args.sessionToken,
  })
}
