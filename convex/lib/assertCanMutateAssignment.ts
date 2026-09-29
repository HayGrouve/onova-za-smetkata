import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { isBillOwner } from './bill_ownership'
import { getOptionalAuthUserId } from './auth'
import { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages'
import { requireGuestSession } from './requireGuestSession'

export async function assertCanMutateAssignment(
  ctx: MutationCtx,
  args: {
    billId: Id<'bills'>
    participantId: Id<'participants'>
    sessionToken?: string
  },
): Promise<void> {
  // The Host edits directly. Anyone else — including a signed-in user who is a
  // Guest on a friend's bill — must hold a guest session for the seat.
  const userId = await getOptionalAuthUserId(ctx)
  if (userId !== null && isBillOwner(await ctx.db.get(args.billId), userId)) {
    return
  }

  if (!args.sessionToken) {
    throw new ConvexError(GUEST_FLOW_MESSAGES.sessionRequired)
  }

  await requireGuestSession(ctx, {
    billId: args.billId,
    participantId: args.participantId,
    sessionToken: args.sessionToken,
  })
}
