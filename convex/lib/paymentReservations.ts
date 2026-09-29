import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  holdsCoveredSeats,
  isAwaitingHostConfirmation,
} from '../../shared/combined-payment'
import { isGuestSessionActive } from './guestSession'

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
