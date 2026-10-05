import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages'
import { sessionSeatIds } from '../../shared/guest-seat-selection'
import { getOptionalAuthUserId } from './auth'
import { isBillOwner } from './bill_ownership'
import { cancelReservationsForSession } from './paymentReservations'

/** Session expires if no heartbeat within this window. */
export const GUEST_SESSION_TTL_MS = 90_000

export function isGuestSessionActive(
  lastSeenAt: number,
  now = Date.now(),
): boolean {
  return now - lastSeenAt < GUEST_SESSION_TTL_MS
}

/**
 * A Guest phone acting on a bill through its live session. A live session
 * implies the current share link — rotating the link, finalizing or deleting
 * the bill ends every session — so a phone that has one needs no share token.
 */
export type GuestActor = {
  kind: 'guest'
  session: Doc<'guestSessions'>
  bill: Doc<'bills'>
  /** Seats this phone handles: own seat first, then Covered seats. */
  seatIds: Id<'participants'>[]
}

/** Whoever acts for a seat: the signed-in Host, or a Guest phone holding it. */
export type SeatActor = { kind: 'host'; bill: Doc<'bills'> } | GuestActor

/** The Guest phone behind `sessionToken`, or null without a live session on this bill. */
export async function findGuest(
  ctx: QueryCtx | MutationCtx,
  args: { billId: Id<'bills'>; sessionToken: string },
): Promise<GuestActor | null> {
  const session = await ctx.db
    .query('guestSessions')
    .withIndex('by_sessionToken', (q) =>
      q.eq('sessionToken', args.sessionToken),
    )
    .first()
  if (
    !session ||
    session.billId !== args.billId ||
    !isGuestSessionActive(session.lastSeenAt)
  ) {
    return null
  }
  const bill = await ctx.db.get(args.billId)
  if (!bill) return null
  return {
    kind: 'guest',
    session,
    bill,
    seatIds: sessionSeatIds(session) as Id<'participants'>[],
  }
}

/**
 * The Guest phone behind `sessionToken`. With `seatId`, the phone must also
 * hold that seat — its own or a Covered seat.
 */
export async function requireGuest(
  ctx: MutationCtx,
  args: {
    billId: Id<'bills'>
    sessionToken: string
    seatId?: Id<'participants'>
  },
): Promise<GuestActor> {
  if (args.seatId !== undefined) {
    const seat = await ctx.db.get(args.seatId)
    if (!seat || seat.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.participantNotOnBill)
    }
  }
  const guest = await findGuest(ctx, args)
  if (
    !guest ||
    (args.seatId !== undefined && !guest.seatIds.includes(args.seatId))
  ) {
    throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
  }
  return guest
}

/**
 * Who may act for `seatId`: the Host for any seat on their bill; anyone else —
 * including a signed-in user who is a Guest on a friend's bill — only through a
 * Guest session that holds the seat.
 */
export async function requireSeatActor(
  ctx: MutationCtx,
  args: {
    billId: Id<'bills'>
    seatId: Id<'participants'>
    sessionToken?: string
  },
): Promise<SeatActor> {
  const bill = await ctx.db.get(args.billId)
  if (bill && isBillOwner(bill, await getOptionalAuthUserId(ctx))) {
    return { kind: 'host', bill }
  }
  if (!args.sessionToken) {
    throw new ConvexError(GUEST_FLOW_MESSAGES.sessionRequired)
  }
  return await requireGuest(ctx, {
    billId: args.billId,
    sessionToken: args.sessionToken,
    seatId: args.seatId,
  })
}

/** A phone leaves the bill: unsent reservations go with it, sent transfers stay for the Host. */
export async function endGuestSession(
  ctx: MutationCtx,
  session: Doc<'guestSessions'>,
): Promise<void> {
  await cancelReservationsForSession(ctx, session._id)
  await ctx.db.delete(session._id)
}

async function sessionsForBill(ctx: MutationCtx, billId: Id<'bills'>) {
  return await ctx.db
    .query('guestSessions')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
}

/** Sign every phone off the bill: the link rotated, or the bill was finalized or deleted. */
export async function endGuestSessionsForBill(
  ctx: MutationCtx,
  billId: Id<'bills'>,
): Promise<void> {
  for (const session of await sessionsForBill(ctx, billId)) {
    await endGuestSession(ctx, session)
  }
}

/** Phones that went quiet past the TTL leave, freeing their seats. */
export async function endExpiredGuestSessions(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  now: number,
): Promise<void> {
  for (const session of await sessionsForBill(ctx, billId)) {
    if (!isGuestSessionActive(session.lastSeenAt, now)) {
      await endGuestSession(ctx, session)
    }
  }
}

/**
 * A seat leaves the bill: the phone whose own seat it was leaves too, and every
 * other phone drops it from its Covered seats.
 */
export async function dropSeatFromGuestSessions(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  participantId: Id<'participants'>,
): Promise<void> {
  for (const session of await sessionsForBill(ctx, billId)) {
    if (session.participantId === participantId) {
      await endGuestSession(ctx, session)
      continue
    }
    const covered = session.coveredParticipantIds ?? []
    if (covered.includes(participantId)) {
      await ctx.db.patch(session._id, {
        coveredParticipantIds: covered.filter((id) => id !== participantId),
      })
    }
  }
}
