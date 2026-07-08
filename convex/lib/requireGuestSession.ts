import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { isGuestSessionActive } from './guestSession'

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
    throw new ConvexError('Участникът не принадлежи на тази сметка.')
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
    throw new ConvexError('Сесията изтече. Изберете името си отново.')
  }

  if (!isGuestSessionActive(session.lastSeenAt)) {
    await ctx.db.delete(session._id)
    throw new ConvexError('Сесията изтече. Изберете името си отново.')
  }

  return { sessionId: session._id }
}
