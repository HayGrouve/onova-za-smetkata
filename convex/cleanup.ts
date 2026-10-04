import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import { GUEST_SESSION_TTL_MS } from './lib/guestSession'
import { cancelReservationsForSession } from './lib/paymentReservations'

/** Buckets older than this are stale (longest app rate-limit window is 1 hour). */
const RATE_LIMIT_MAX_AGE_MS = 2 * 60 * 60 * 1000

/** Receipt scans kept for 30 days, finished or not. */
const RECEIPT_SCAN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** Stripe stops retrying a webhook after three days; keep event ids for 30. */
const WEBHOOK_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/** Rows deleted per table per run; a full batch schedules another run. */
export const CLEANUP_BATCH_SIZE = 200

/** Stale buckets read per run while skipping monthly usage counters. */
const BUCKET_SCAN_LIMIT = 2_000

/**
 * Purge stale rows through indexes, a bounded batch at a time. Reading whole
 * tables would eventually exceed Convex's per-transaction read limit and stop
 * the cleanup for good, so a busy table is worked off over follow-up runs.
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    const sessions = await ctx.db
      .query('guestSessions')
      .withIndex('by_lastSeenAt', (q) =>
        q.lte('lastSeenAt', now - GUEST_SESSION_TTL_MS),
      )
      .take(CLEANUP_BATCH_SIZE)
    for (const session of sessions) {
      await cancelReservationsForSession(ctx, session._id)
      await ctx.db.delete(session._id)
    }

    // Newest stale first: monthly usage counters (`usage:…`, kept for quotas)
    // pile up at the old end of the index and must not starve the scan.
    let purgedBuckets = 0
    let scannedBuckets = 0
    for await (const bucket of ctx.db
      .query('rateLimitBuckets')
      .withIndex('by_windowStart', (q) =>
        q.lt('windowStart', now - RATE_LIMIT_MAX_AGE_MS),
      )
      .order('desc')) {
      scannedBuckets++
      if (!bucket.key.startsWith('usage:')) {
        await ctx.db.delete(bucket._id)
        purgedBuckets++
      }
      if (
        purgedBuckets >= CLEANUP_BATCH_SIZE ||
        scannedBuckets >= BUCKET_SCAN_LIMIT
      ) {
        break
      }
    }

    const scans = await ctx.db
      .query('receiptScans')
      .withIndex('by_createdAt', (q) =>
        q.lt('createdAt', now - RECEIPT_SCAN_RETENTION_MS),
      )
      .take(CLEANUP_BATCH_SIZE)
    for (const scan of scans) {
      await ctx.db.delete(scan._id)
    }

    const webhookEvents = await ctx.db
      .query('processedWebhookEvents')
      .withIndex('by_processedAt', (q) =>
        q.lt('processedAt', now - WEBHOOK_EVENT_RETENTION_MS),
      )
      .take(CLEANUP_BATCH_SIZE)
    for (const event of webhookEvents) {
      await ctx.db.delete(event._id)
    }

    const moreLeft =
      sessions.length === CLEANUP_BATCH_SIZE ||
      purgedBuckets === CLEANUP_BATCH_SIZE ||
      scans.length === CLEANUP_BATCH_SIZE ||
      webhookEvents.length === CLEANUP_BATCH_SIZE
    if (moreLeft) {
      await ctx.scheduler.runAfter(0, internal.cleanup.run, {})
    }

    return {
      purgedSessions: sessions.length,
      purgedBuckets,
      purgedScans: scans.length,
      purgedWebhookEvents: webhookEvents.length,
    }
  },
})
