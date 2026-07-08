import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
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
    throw new ConvexError('Участникът не принадлежи на тази сметка.')
  }
  return participant
}

function claimActorKey(sessionToken: string, deviceId?: string): string {
  const device = deviceId?.trim().slice(0, 64)
  if (device) return `device:${device}`
  return `token:${sessionToken.slice(0, 36)}`
}

async function assertClaimRateLimits(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  sessionToken: string,
  deviceId?: string,
) {
  const actor = claimActorKey(sessionToken, deviceId)
  await assertRateLimit(
    ctx,
    `claim:actor:${actor}:bill:${billId}`,
    10,
    60_000,
    'Твърде много опити за присъединяване. Опитайте отново след малко.',
  )
  await assertRateLimit(
    ctx,
    `claim:bill:${billId}`,
    100,
    60_000,
    'Твърде много опити за присъединяване към тази сметка. Опитайте отново след малко.',
  )
}

export const listActiveForBill = query({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)
    const now = Date.now()
    const sessions = await ctx.db
      .query('guestSessions')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    return sessions
      .filter((session) => isGuestSessionActive(session.lastSeenAt, now))
      .map((session) => ({
        participantId: session.participantId,
        lastSeenAt: session.lastSeenAt,
      }))
  },
})

export const claim = mutation({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    participantId: v.id('participants'),
    sessionToken: v.string(),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)
    await assertClaimRateLimits(
      ctx,
      args.billId,
      args.sessionToken,
      args.deviceId,
    )

    const now = Date.now()
    await assertParticipantOnBill(ctx, args.billId, args.participantId)
    await purgeExpiredSessionsForBill(ctx, args.billId, now)

    const sessions = await ctx.db
      .query('guestSessions')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    const activeForParticipant = sessions.find(
      (session) =>
        session.participantId === args.participantId &&
        isGuestSessionActive(session.lastSeenAt, now),
    )

    if (activeForParticipant) {
      if (activeForParticipant.sessionToken === args.sessionToken) {
        await ctx.db.patch(activeForParticipant._id, { lastSeenAt: now })
        return { ok: true as const }
      }
      throw new ConvexError('Това име вече е заето от друг телефон.')
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
      sessionToken: args.sessionToken,
      lastSeenAt: now,
      createdAt: now,
    })
    return { ok: true as const }
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
  participantId: Id<'participants'>,
) {
  const sessions = await ctx.db
    .query('guestSessions')
    .withIndex('by_participantId', (q) => q.eq('participantId', participantId))
    .collect()
  for (const session of sessions) {
    await ctx.db.delete(session._id)
  }
}

/** Exported for tests / docs — heartbeat interval should stay below TTL. */
export { GUEST_SESSION_TTL_MS }
