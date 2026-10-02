import { internalMutation } from './_generated/server'
import { GUEST_SESSION_TTL_MS } from './lib/guestSession'
import { cancelReservationsForSession } from './lib/paymentReservations'

/** Buckets older than this are stale (longest app rate-limit window is 1 hour). */
const RATE_LIMIT_MAX_AGE_MS = 2 * 60 * 60 * 1000

/** Terminal receipt scans kept for 30 days. */
const RECEIPT_SCAN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** Stripe stops retrying a webhook after three days; keep event ids for 30. */
const WEBHOOK_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

const BATCH_SIZE = 200

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    let purgedSessions = 0
    let purgedBuckets = 0
    let purgedScans = 0
    let purgedWebhookEvents = 0

    const sessions = await ctx.db.query('guestSessions').collect()
    for (const session of sessions) {
      if (!isGuestSessionExpired(session.lastSeenAt, now)) continue
      await cancelReservationsForSession(ctx, session._id)
      await ctx.db.delete(session._id)
      purgedSessions++
      if (purgedSessions >= BATCH_SIZE) break
    }

    const buckets = await ctx.db.query('rateLimitBuckets').collect()
    for (const bucket of buckets) {
      if (bucket.key.startsWith('usage:')) continue
      if (now - bucket.windowStart < RATE_LIMIT_MAX_AGE_MS) continue
      await ctx.db.delete(bucket._id)
      purgedBuckets++
      if (purgedBuckets >= BATCH_SIZE) break
    }

    const scans = await ctx.db.query('receiptScans').collect()
    for (const scan of scans) {
      if (scan.status !== 'done' && scan.status !== 'failed') continue
      if (now - scan.createdAt < RECEIPT_SCAN_RETENTION_MS) continue
      await ctx.db.delete(scan._id)
      purgedScans++
      if (purgedScans >= BATCH_SIZE) break
    }

    const webhookEvents = await ctx.db
      .query('processedWebhookEvents')
      .withIndex('by_processedAt', (q) =>
        q.lt('processedAt', now - WEBHOOK_EVENT_RETENTION_MS),
      )
      .take(BATCH_SIZE)
    for (const event of webhookEvents) {
      await ctx.db.delete(event._id)
      purgedWebhookEvents++
    }

    return { purgedSessions, purgedBuckets, purgedScans, purgedWebhookEvents }
  },
})

function isGuestSessionExpired(lastSeenAt: number, now: number): boolean {
  return now - lastSeenAt >= GUEST_SESSION_TTL_MS
}
