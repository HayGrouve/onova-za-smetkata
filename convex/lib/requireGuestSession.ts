import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { isGuestSessionActive } from './guestSession'
import { GUEST_FLOW_MESSAGES } from './guestFlowMessages'

export async function requireGuestSession(
  ctx: MutationCtx,
  args: {
    billId: Id<'bills'>
    participantId: Id<'participants'>
    sessionToken: string
  },
): Promise<{ sessionId: Id<'guestSessions'> }> {
  const participant = await ctx.db.get(args.participantId)
  if (!participant || participant.billId !== args.billId) {
    throw new ConvexError(GUEST_FLOW_MESSAGES.participantNotOnBill)
  }

  const session = await ctx.db
    .query('guestSessions')
    .withIndex('by_sessionToken', (q) =>
      q.eq('sessionToken', args.sessionToken),
    )
    .first()

  if (
    !session ||
    session.billId !== args.billId ||
    session.participantId !== args.participantId
  ) {
    throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
  }

  if (!isGuestSessionActive(session.lastSeenAt)) {
    await ctx.db.delete(session._id)
    throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
  }

  return { sessionId: session._id }
}
