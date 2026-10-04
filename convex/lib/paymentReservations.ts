import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  getCoveredParticipantIds,
  holdsCoveredSeats,
  isAwaitingHostConfirmation,
} from '../../shared/combined-payment'
import { isGuestSessionActive } from './guestSession'
import { COMBINED_PAYMENT_MESSAGES } from '../../shared/combined-payment-messages'

/**
 * Pending pay-for-others requests on a bill that still lock their Covered
 * seats. Reservations from a phone that left (released or expired session)
 * no longer count, so the covered Guest can pay again.
 */
export async function loadSeatHoldingRequests(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
): Promise<Doc<'combinedPaymentRequests'>[]> {
  const pending = await ctx.db
    .query('combinedPaymentRequests')
    .withIndex('by_billId_status', (q) =>
      q.eq('billId', billId).eq('status', 'pending'),
    )
    .collect()
  const now = Date.now()
  const holding: Doc<'combinedPaymentRequests'>[] = []
  for (const request of pending) {
    const session = await ctx.db.get(request.guestSessionId)
    const alive =
      session !== null && isGuestSessionActive(session.lastSeenAt, now)
    if (holdsCoveredSeats(request, alive)) holding.push(request)
  }
  return holding
}

/**
 * Hand a seat's pending pay requests to the phone that now holds the seat. A
 * phone that sat in the Revolut app past the session TTL comes back with a new
 * session: its sent transfer must still read „Чака“ there instead of inviting a
 * second payment. Requests whose phone is still around stay where they are.
 */
export async function adoptSeatRequests(
  ctx: MutationCtx,
  args: {
    billId: Id<'bills'>
    participantId: Id<'participants'>
    sessionId: Id<'guestSessions'>
  },
): Promise<void> {
  const pending = await ctx.db
    .query('combinedPaymentRequests')
    .withIndex('by_billId_status', (q) =>
      q.eq('billId', args.billId).eq('status', 'pending'),
    )
    .collect()
  for (const request of pending) {
    if (request.payerParticipantId !== args.participantId) continue
    if (request.guestSessionId === args.sessionId) continue
    if ((await ctx.db.get(request.guestSessionId)) !== null) continue
    await ctx.db.patch(request._id, { guestSessionId: args.sessionId })
  }
}

/** Delete every pay request of a bill that is being deleted. */
export async function deleteRequestsForBill(
  ctx: MutationCtx,
  billId: Id<'bills'>,
): Promise<void> {
  const requests = await ctx.db
    .query('combinedPaymentRequests')
    .withIndex('by_billId_status', (q) => q.eq('billId', billId))
    .collect()
  for (const request of requests) {
    await ctx.db.delete(request._id)
  }
}

/**
 * Close the bill's pay requests before it locks. A sent transfer must be
 * confirmed or rejected by the Host first — after finalize nobody could.
 */
export async function settleRequestsForFinalize(
  ctx: MutationCtx,
  billId: Id<'bills'>,
): Promise<void> {
  const pending = await ctx.db
    .query('combinedPaymentRequests')
    .withIndex('by_billId_status', (q) =>
      q.eq('billId', billId).eq('status', 'pending'),
    )
    .collect()
  if (pending.some((request) => isAwaitingHostConfirmation(request))) {
    throw new ConvexError(COMBINED_PAYMENT_MESSAGES.transfersAwaitingHost)
  }
  const now = Date.now()
  for (const request of pending) {
    await ctx.db.patch(request._id, { status: 'cancelled', resolvedAt: now })
  }
}

/** Cancel every pending pay request that pays for or covers a removed seat. */
export async function cancelRequestsForParticipant(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  participantId: Id<'participants'>,
): Promise<void> {
  const pending = await ctx.db
    .query('combinedPaymentRequests')
    .withIndex('by_billId_status', (q) =>
      q.eq('billId', billId).eq('status', 'pending'),
    )
    .collect()
  const now = Date.now()
  for (const request of pending) {
    if (
      request.payerParticipantId !== participantId &&
      !getCoveredParticipantIds(request).includes(participantId)
    ) {
      continue
    }
    await ctx.db.patch(request._id, { status: 'cancelled', resolvedAt: now })
  }
}

/** Cancel a leaving phone's reservations; started transfers stay for the Host. */
export async function cancelReservationsForSession(
  ctx: MutationCtx,
  sessionId: Id<'guestSessions'>,
): Promise<number> {
  const requests = await ctx.db
    .query('combinedPaymentRequests')
    .withIndex('by_guestSessionId', (q) => q.eq('guestSessionId', sessionId))
    .collect()
  let cancelled = 0
  for (const request of requests) {
    if (request.status !== 'pending' || isAwaitingHostConfirmation(request)) {
      continue
    }
    await ctx.db.patch(request._id, {
      status: 'cancelled',
      resolvedAt: Date.now(),
    })
    cancelled++
  }
  return cancelled
}
