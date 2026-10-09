import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { endGuestSession, GUEST_SESSION_TTL_MS } from './lib/guestSession'
import { deleteStoredPhoto, isPhotoHeld } from './lib/receiptStorage'

/** Buckets older than this are stale (longest app rate-limit window is 1 hour). */
const RATE_LIMIT_MAX_AGE_MS = 2 * 60 * 60 * 1000

/**
 * Monthly usage counters (`usage:…`) only matter for their own month; the
 * quota reads the current month's key. Keep two months for safety.
 */
const USAGE_COUNTER_MAX_AGE_MS = 62 * 24 * 60 * 60 * 1000

/** Receipt scans kept for 30 days, finished or not. */
const RECEIPT_SCAN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * A quick bill's phone discards its scan once it has the lines; a scan still
 * here after a day was abandoned (photo included, if the read never ran).
 */
const QUICK_SCAN_RETENTION_MS = 24 * 60 * 60 * 1000

/** Stripe stops retrying a webhook after three days; keep event ids for 30. */
const WEBHOOK_EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * A photo is only taken within minutes of its upload (`assertFreshUpload`), so
 * one that is still unheld a day later was abandoned (the phone lost signal,
 * the Host closed the tab) and nothing will ever delete it.
 */
const ORPHAN_UPLOAD_MIN_AGE_MS = 24 * 60 * 60 * 1000

/** Stored files checked per run; each costs a few index reads. */
const ORPHAN_UPLOAD_BATCH_SIZE = 100

/** Rows deleted per table per run; a full batch schedules another run. */
export const CLEANUP_BATCH_SIZE = 200

/** Buckets read per run (live usage counters are read but kept). */
const BUCKET_SCAN_LIMIT = 2_000

const bucketCursorValidator = v.object({
  windowStart: v.number(),
  creationTime: v.number(),
})

/** A position in `rateLimitBuckets.by_windowStart` (`windowStart, _creationTime`). */
type BucketCursor = { windowStart: number; creationTime: number }

/**
 * Buckets strictly before `cursor` in index order, newest first: the rest of
 * the cursor's millisecond, then everything older. A plain `windowStart`
 * cursor would either skip rows sharing that millisecond or reread them
 * forever when more than a scan's worth share it.
 */
async function* staleBucketsNewestFirst(
  ctx: MutationCtx,
  cursor: BucketCursor,
) {
  yield* ctx.db
    .query('rateLimitBuckets')
    .withIndex('by_windowStart', (q) =>
      q
        .eq('windowStart', cursor.windowStart)
        .lt('_creationTime', cursor.creationTime),
    )
    .order('desc')
  yield* ctx.db
    .query('rateLimitBuckets')
    .withIndex('by_windowStart', (q) => q.lt('windowStart', cursor.windowStart))
    .order('desc')
}

/**
 * Purge stale rows through indexes, a bounded batch at a time. Reading whole
 * tables would eventually exceed Convex's per-transaction read limit and stop
 * the cleanup for good, so a busy table is worked off over follow-up runs.
 */
export const run = internalMutation({
  args: {
    /** Follow-up runs resume the bucket scan strictly below this index key. */
    bucketsBefore: v.optional(bucketCursorValidator),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    const sessions = await ctx.db
      .query('guestSessions')
      .withIndex('by_lastSeenAt', (q) =>
        q.lte('lastSeenAt', now - GUEST_SESSION_TTL_MS),
      )
      .take(CLEANUP_BATCH_SIZE)
    for (const session of sessions) {
      await endGuestSession(ctx, session)
    }

    // Live usage counters share the index with stale rate-limit buckets and
    // are skipped, so a run that stops early hands its position to the next
    // one instead of rescanning the same rows forever.
    let purgedBuckets = 0
    let scannedBuckets = 0
    let bucketCursor: BucketCursor | undefined
    for await (const bucket of staleBucketsNewestFirst(
      ctx,
      args.bucketsBefore ?? {
        windowStart: now - RATE_LIMIT_MAX_AGE_MS,
        creationTime: 0,
      },
    )) {
      scannedBuckets++
      const maxAgeMs = bucket.key.startsWith('usage:')
        ? USAGE_COUNTER_MAX_AGE_MS
        : RATE_LIMIT_MAX_AGE_MS
      if (now - bucket.windowStart >= maxAgeMs) {
        await ctx.db.delete(bucket._id)
        purgedBuckets++
      }
      if (
        purgedBuckets >= CLEANUP_BATCH_SIZE ||
        scannedBuckets >= BUCKET_SCAN_LIMIT
      ) {
        bucketCursor = {
          windowStart: bucket.windowStart,
          creationTime: bucket._creationTime,
        }
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

    const quickScans = await ctx.db
      .query('quickScans')
      .withIndex('by_createdAt', (q) =>
        q.lt('createdAt', now - QUICK_SCAN_RETENTION_MS),
      )
      .take(CLEANUP_BATCH_SIZE)
    for (const scan of quickScans) {
      if (scan.storageId) await deleteStoredPhoto(ctx, scan.storageId)
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
      bucketCursor !== undefined ||
      scans.length === CLEANUP_BATCH_SIZE ||
      quickScans.length === CLEANUP_BATCH_SIZE ||
      webhookEvents.length === CLEANUP_BATCH_SIZE
    if (moreLeft) {
      await ctx.scheduler.runAfter(0, internal.cleanup.run, {
        ...(bucketCursor !== undefined ? { bucketsBefore: bucketCursor } : {}),
      })
    }

    return {
      purgedSessions: sessions.length,
      purgedBuckets,
      purgedScans: scans.length,
      purgedQuickScans: quickScans.length,
      purgedWebhookEvents: webhookEvents.length,
    }
  },
})

/**
 * Delete uploaded photos that no bill, receipt scan or quick scan holds. Walks
 * storage oldest first and stops at the first file younger than a day, handing
 * its place to a follow-up run in batches so one run stays far below the
 * per-transaction read limit. Files that are held are checked again each day.
 */
export const sweepOrphanUploads = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - ORPHAN_UPLOAD_MIN_AGE_MS
    const page = await ctx.db.system
      .query('_storage')
      .order('asc')
      .paginate({
        numItems: ORPHAN_UPLOAD_BATCH_SIZE,
        cursor: args.cursor ?? null,
      })

    let deleted = 0
    let reachedRecentUploads = false
    for (const file of page.page) {
      if (file._creationTime > cutoff) {
        reachedRecentUploads = true
        break
      }
      if (await isPhotoHeld(ctx, file._id)) continue
      await ctx.storage.delete(file._id)
      deleted++
    }

    if (!page.isDone && !reachedRecentUploads) {
      await ctx.scheduler.runAfter(0, internal.cleanup.sweepOrphanUploads, {
        cursor: page.continueCursor,
      })
    }
    return { deletedUploads: deleted }
  },
})
