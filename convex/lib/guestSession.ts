import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages'
import { sessionSeatIds } from '../../shared/guest-seat-selection'
import { getOptionalAuthUserId } from './auth'
import { isBillOwner } from './bill_ownership'
import { onGuestSessionEnded } from './payRequest'

/** Session expires if no heartbeat within this window. */
export const GUEST_SESSION_TTL_MS = 90_000

/**
 * `now` is required on purpose: only mutations and sweeps may decide liveness.
 * A query that asked the clock would be stale the moment it was sent and would
 * pull a heartbeat's write into every subscription that reads it.
 */
export function isGuestSessionActive(lastSeenAt: number, now: number): boolean {
  return now - lastSeenAt < GUEST_SESSION_TTL_MS
}

// ── Presence ─────────────────────────────────────────────────────────────
//
// Liveness is `guestSessionPresence.lastSeenAt`, written by the heartbeat. The
// session row itself changes only on real events (a seat taken or changed, the
// phone leaving), so queries that read sessions — and the bill — stay quiet
// while phones merely check in. Queries therefore never decide who is alive:
// a phone that went quiet keeps its seat on screen until the minute sweep
// (`endQuietGuestSessions`) signs it off, while every mutation still refuses
// it the moment its TTL passes.

async function presenceRowsOf(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<'guestSessions'>,
) {
  return await ctx.db
    .query('guestSessionPresence')
    .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
    .collect()
}

async function presenceOf(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<'guestSessions'>,
) {
  return await ctx.db
    .query('guestSessionPresence')
    .withIndex('by_sessionId', (q) => q.eq('sessionId', sessionId))
    .first()
}

/**
 * When the phone last checked in. Sessions opened before the presence table
 * existed have no row and fall back to the time written on the session.
 */
async function lastSeenAtOf(
  ctx: MutationCtx,
  session: Doc<'guestSessions'>,
): Promise<number> {
  const presence = await presenceOf(ctx, session._id)
  return presence?.lastSeenAt ?? session.lastSeenAt
}

/** Mutations only: the phone checked in within the TTL. */
export async function isGuestSessionLive(
  ctx: MutationCtx,
  session: Doc<'guestSessions'>,
  now: number,
): Promise<boolean> {
  return isGuestSessionActive(await lastSeenAtOf(ctx, session), now)
}

/** The phone checks in: the one write a heartbeat makes. */
export async function touchGuestPresence(
  ctx: MutationCtx,
  session: Pick<Doc<'guestSessions'>, '_id' | 'billId'>,
  now: number,
): Promise<void> {
  const presence = await presenceOf(ctx, session._id)
  if (presence) {
    await ctx.db.patch(presence._id, { lastSeenAt: now })
    return
  }
  await ctx.db.insert('guestSessionPresence', {
    sessionId: session._id,
    billId: session.billId,
    lastSeenAt: now,
  })
}

/** Sessions on the bill that checked in within the TTL (mutations only). */
export async function liveSessionsForBill(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  now: number,
): Promise<Doc<'guestSessions'>[]> {
  const { live } = await partitionSessionsForBill(ctx, billId, now)
  return live
}

async function partitionSessionsForBill(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  now: number,
) {
  const sessions = await sessionsForBill(ctx, billId)
  const presence = await ctx.db
    .query('guestSessionPresence')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
  const seenAt = new Map(presence.map((row) => [row.sessionId, row.lastSeenAt]))
  const live: Doc<'guestSessions'>[] = []
  const quiet: Doc<'guestSessions'>[] = []
  for (const session of sessions) {
    const lastSeenAt = seenAt.get(session._id) ?? session.lastSeenAt
    ;(isGuestSessionActive(lastSeenAt, now) ? live : quiet).push(session)
  }
  return { live, quiet }
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

/**
 * The Guest phone behind `sessionToken` on this bill, or null. Reads no
 * clock and no presence, so it is safe in queries: a phone that went quiet is
 * still found until the minute sweep ends its session. Acting for a seat goes
 * through `requireGuest`, which also checks the TTL.
 */
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
  if (!session || session.billId !== args.billId) return null
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
    !(await isGuestSessionLive(ctx, guest.session, Date.now())) ||
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
  await onGuestSessionEnded(ctx, session._id)
  for (const presence of await presenceRowsOf(ctx, session._id)) {
    await ctx.db.delete(presence._id)
  }
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

/**
 * Phones on the bill that went quiet past the TTL leave, freeing their seats.
 * Returns the sessions that are left, all of them live.
 */
export async function endExpiredGuestSessions(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  now: number,
): Promise<Doc<'guestSessions'>[]> {
  const { live, quiet } = await partitionSessionsForBill(ctx, billId, now)
  for (const session of quiet) {
    await endGuestSession(ctx, session)
  }
  return live
}

/**
 * Sign off every phone that went quiet past the TTL, whatever the bill — the
 * only thing that frees a seat on screen, since queries do not read the clock.
 * Works through at most `limit` presence rows; `more` says a full batch is
 * left to the next run. With `legacy`, also ends sessions opened before the
 * presence table existed (no row, old `lastSeenAt`); oldest first, so those
 * come before any session that has a presence row.
 */
export async function endQuietGuestSessions(
  ctx: MutationCtx,
  now: number,
  limit: number,
  options: { legacy?: boolean } = {},
): Promise<{ ended: number; more: boolean }> {
  const cutoff = now - GUEST_SESSION_TTL_MS
  let ended = 0

  const quiet = await ctx.db
    .query('guestSessionPresence')
    .withIndex('by_lastSeenAt', (q) => q.lte('lastSeenAt', cutoff))
    .take(limit)
  for (const presence of quiet) {
    const session = await ctx.db.get(presence.sessionId)
    if (session) {
      await endGuestSession(ctx, session)
      ended++
    } else {
      await ctx.db.delete(presence._id)
    }
  }
  let more = quiet.length === limit

  if (options.legacy) {
    const old = await ctx.db
      .query('guestSessions')
      .withIndex('by_lastSeenAt', (q) => q.lte('lastSeenAt', cutoff))
      .take(limit)
    let endedLegacy = 0
    for (const session of old) {
      if (await presenceOf(ctx, session._id)) continue
      await endGuestSession(ctx, session)
      endedLegacy++
    }
    ended += endedLegacy
    // Skipped rows stay behind: only a batch that made progress asks for more.
    more = more || (endedLegacy > 0 && old.length === limit)
  }
  return { ended, more }
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
