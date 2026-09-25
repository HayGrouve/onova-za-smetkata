import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import {
  buildClaimActorKey,
  parseGuestClaimInput,
} from '../shared/guest-claim-schema'
import { GUEST_FLOW_MESSAGES } from '../shared/guest-flow-messages'
import {
  sessionSeatIds,
  validateCoveredSeatSelection,
} from '../shared/guest-seat-selection'
import { assertBillDraft } from './lib/assertBillDraft'
import { GUEST_SESSION_TTL_MS, isGuestSessionActive } from './lib/guestSession'
import { requireGuestSession } from './lib/requireGuestSession'
import { assertRateLimit } from './lib/rateLimit'
import { assertShareToken } from './lib/guestAccess'

async function purgeExpiredSessionsForBill(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  now: number,
) {
  const sessions = await ctx.db
    .query('guestSessions')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
  for (const session of sessions) {
    if (!isGuestSessionActive(session.lastSeenAt, now)) {
      await ctx.db.delete(session._id)
    }
  }
}

async function assertParticipantOnBill(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  participantId: Id<'participants'>,
) {
  const participant = await ctx.db.get(participantId)
  if (!participant || participant.billId !== billId) {
    throw new ConvexError(GUEST_FLOW_MESSAGES.participantNotOnBill)
  }
  return participant
}

/** Validate Covered seats against the bill and other phones' active sessions. */
async function resolveCoveredSeats(
  ctx: MutationCtx,
  args: {
    bill: Doc<'bills'>
    ownParticipantId: Id<'participants'>
    coveredParticipantIds: Id<'participants'>[]
    otherSessions: Doc<'guestSessions'>[]
  },
): Promise<Id<'participants'>[]> {
  const participants = await ctx.db
    .query('participants')
    .withIndex('by_billId', (q) => q.eq('billId', args.bill._id))
    .collect()
  const takenByOtherSessions = new Set<string>(
    args.otherSessions.flatMap((session) => sessionSeatIds(session)),
  )
  const validated = validateCoveredSeatSelection({
    ownParticipantId: args.ownParticipantId,
    coveredParticipantIds: args.coveredParticipantIds,
    billParticipantIds: participants.map((participant) => participant._id),
    hostParticipantId: args.bill.hostParticipantId,
    takenByOtherSessions,
  })
  if (!validated.ok) {
    throw new ConvexError(validated.message)
  }
  return validated.coveredParticipantIds as Id<'participants'>[]
}

async function assertClaimRateLimits(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  sessionToken: string,
  deviceId?: string,
) {
  const actor = buildClaimActorKey(sessionToken, deviceId)
  await assertRateLimit(
    ctx,
    `claim:actor:${actor}:bill:${billId}`,
    10,
    60_000,
    GUEST_FLOW_MESSAGES.claimRateLimitActor,
  )
  await assertRateLimit(
    ctx,
    `claim:bill:${billId}`,
    100,
    60_000,
    GUEST_FLOW_MESSAGES.claimRateLimitBill,
  )
}

type ActiveSeat = {
  participantId: Id<'participants'>
  heldByParticipantId?: Id<'participants'>
  lastSeenAt: number
}

export const listActiveForBill = query({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
  },
  returns: v.array(
    v.object({
      participantId: v.id('participants'),
      /** Set for Covered seats: the holding session's own seat. */
      heldByParticipantId: v.optional(v.id('participants')),
      lastSeenAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)
    const now = Date.now()
    const sessions = await ctx.db
      .query('guestSessions')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    return sessions
      .filter((session) => isGuestSessionActive(session.lastSeenAt, now))
      .flatMap((session): ActiveSeat[] => [
        {
          participantId: session.participantId,
          lastSeenAt: session.lastSeenAt,
        },
        ...(session.coveredParticipantIds ?? []).map((participantId) => ({
          participantId,
          heldByParticipantId: session.participantId,
          lastSeenAt: session.lastSeenAt,
        })),
      ])
  },
})

export const claim = mutation({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    participantId: v.id('participants'),
    sessionToken: v.string(),
    deviceId: v.optional(v.string()),
    /** Covered seats this phone also claims and pays for. */
    coveredParticipantIds: v.optional(v.array(v.id('participants'))),
  },
  handler: async (ctx, args) => {
    const bill = await assertShareToken(ctx, args.billId, args.shareToken)

    const parsedDevice = parseGuestClaimInput({ deviceId: args.deviceId })
    if (!parsedDevice.ok) {
      throw new ConvexError(parsedDevice.message)
    }

    await assertClaimRateLimits(
      ctx,
      args.billId,
      args.sessionToken,
      parsedDevice.deviceId,
    )

    const now = Date.now()
    await assertParticipantOnBill(ctx, args.billId, args.participantId)
    await purgeExpiredSessionsForBill(ctx, args.billId, now)

    const sessions = (
      await ctx.db
        .query('guestSessions')
        .withIndex('by_billId', (q) => q.eq('billId', args.billId))
        .collect()
    ).filter((session) => isGuestSessionActive(session.lastSeenAt, now))

    const holder = sessions.find((session) =>
      sessionSeatIds(session).includes(args.participantId),
    )
    if (holder && holder.sessionToken !== args.sessionToken) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.nameTaken)
    }

    const coveredParticipantIds =
      args.coveredParticipantIds === undefined
        ? undefined
        : await resolveCoveredSeats(ctx, {
            bill,
            ownParticipantId: args.participantId,
            coveredParticipantIds: args.coveredParticipantIds,
            otherSessions: sessions.filter(
              (session) => session.sessionToken !== args.sessionToken,
            ),
          })

    if (holder && holder.participantId === args.participantId) {
      await ctx.db.patch(holder._id, {
        lastSeenAt: now,
        ...(coveredParticipantIds !== undefined
          ? { coveredParticipantIds }
          : {}),
      })
      return { ok: true as const }
    }

    const existingTokenSession = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (existingTokenSession) {
      await ctx.db.delete(existingTokenSession._id)
    }

    await ctx.db.insert('guestSessions', {
      billId: args.billId,
      participantId: args.participantId,
      ...(coveredParticipantIds && coveredParticipantIds.length > 0
        ? { coveredParticipantIds }
        : {}),
      sessionToken: args.sessionToken,
      lastSeenAt: now,
      createdAt: now,
    })
    return { ok: true as const }
  },
})

/** Change which Covered seats this phone claims and pays for. */
export const updateCoveredSeats = mutation({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.string(),
    coveredParticipantIds: v.array(v.id('participants')),
  },
  handler: async (ctx, args) => {
    const bill = await assertShareToken(ctx, args.billId, args.shareToken)
    assertBillDraft(bill)
    await assertRateLimit(ctx, `coveredSeats:${args.sessionToken}`, 30, 60_000)

    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
    }
    await requireGuestSession(ctx, {
      billId: args.billId,
      participantId: session.participantId,
      sessionToken: args.sessionToken,
    })

    const pendingRequests = (
      await ctx.db
        .query('combinedPaymentRequests')
        .withIndex('by_guestSessionId', (q) =>
          q.eq('guestSessionId', session._id),
        )
        .collect()
    ).filter(
      (request) =>
        request.billId === args.billId && request.status === 'pending',
    )
    if (
      pendingRequests.some((request) => request.transferInitiatedAt != null)
    ) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.coveredSeatsLocked)
    }

    const now = Date.now()
    const sessions = await ctx.db
      .query('guestSessions')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const coveredParticipantIds = await resolveCoveredSeats(ctx, {
      bill,
      ownParticipantId: session.participantId,
      coveredParticipantIds: args.coveredParticipantIds,
      otherSessions: sessions.filter(
        (other) =>
          other._id !== session._id &&
          isGuestSessionActive(other.lastSeenAt, now),
      ),
    })

    // The pay step rebuilds a draft request for the new set of seats.
    for (const request of pendingRequests) {
      await ctx.db.patch(request._id, { status: 'cancelled', resolvedAt: now })
    }
    await ctx.db.patch(session._id, { coveredParticipantIds, lastSeenAt: now })
    return { coveredParticipantIds }
  },
})

export const heartbeat = mutation({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    participantId: v.id('participants'),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)
    await assertRateLimit(ctx, `heartbeat:${args.sessionToken}`, 120, 60_000)
    const { sessionId } = await requireGuestSession(ctx, args)
    await ctx.db.patch(sessionId, { lastSeenAt: Date.now() })
    return { ok: true as const }
  },
})

export const release = mutation({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)
    await assertRateLimit(ctx, `release:${args.sessionToken}`, 20, 60_000)
    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (session && session.billId === args.billId) {
      await ctx.db.delete(session._id)
    }
  },
})

export async function deleteGuestSessionsForBill(
  ctx: MutationCtx,
  billId: Id<'bills'>,
) {
  const sessions = await ctx.db
    .query('guestSessions')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
  for (const session of sessions) {
    await ctx.db.delete(session._id)
  }
}

export async function deleteGuestSessionsForParticipant(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  participantId: Id<'participants'>,
) {
  const sessions = await ctx.db
    .query('guestSessions')
    .withIndex('by_participantId', (q) => q.eq('participantId', participantId))
    .collect()
  for (const session of sessions) {
    await ctx.db.delete(session._id)
  }

  const billSessions = await ctx.db
    .query('guestSessions')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
  for (const session of billSessions) {
    const covered = session.coveredParticipantIds ?? []
    if (covered.includes(participantId)) {
      await ctx.db.patch(session._id, {
        coveredParticipantIds: covered.filter((id) => id !== participantId),
      })
    }
  }
}

/** Exported for tests / docs — heartbeat interval should stay below TTL. */
export { GUEST_SESSION_TTL_MS }
