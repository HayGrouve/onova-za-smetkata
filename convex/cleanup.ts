import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { endQuietGuestSessions } from './lib/guestSession'
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

    // Backstop for the minute sweep (`guestSessions.endQuiet`).
    const sessions = await endQuietGuestSessions(ctx, now, CLEANUP_BATCH_SIZE)

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
      sessions.more ||
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
      purgedSessions: sessions.ended,
      purgedBuckets,
      purgedScans: scans.length,
      purgedQuickScans: quickScans.length,
      purgedWebhookEvents: webhookEvents.length,
    }
  },
})

/**
 * Each daily run checks uploads made one to three days ago; the overlap
 * covers a missed run. A photo needs checking only once: whatever holds it
 * deletes it on letting go (`deleteStoredPhoto`), so it cannot become an
 * orphan later.
 */
const ORPHAN_UPLOAD_WINDOW_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Delete uploaded photos that no bill, receipt scan or quick scan holds, in
 * batches handed to follow-up runs so one run stays far below the
 * per-transaction read limit. `fullBackfill` walks all storage older than a
 * day instead of the window, for a one-off manual run:
 * `npx convex run cleanup:sweepOrphanUploads '{"fullBackfill":true}'`.
 */
export const sweepOrphanUploads = internalMutation({
  args: {
    fullBackfill: v.optional(v.boolean()),
    /** Follow-up runs keep the first run's bounds: a cursor fits one query. */
    next: v.optional(
      v.object({ cursor: v.string(), from: v.number(), to: v.number() }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const to = args.next?.to ?? now - ORPHAN_UPLOAD_MIN_AGE_MS
    const from =
      args.next?.from ?? (args.fullBackfill ? 0 : now - ORPHAN_UPLOAD_WINDOW_MS)
    const page = await ctx.db.system
      .query('_storage')
      .withIndex('by_creation_time', (q) =>
        q.gte('_creationTime', from).lt('_creationTime', to),
      )
      .paginate({
        numItems: ORPHAN_UPLOAD_BATCH_SIZE,
        cursor: args.next?.cursor ?? null,
      })

    let deleted = 0
    for (const file of page.page) {
      if (await isPhotoHeld(ctx, file._id)) continue
      await ctx.storage.delete(file._id)
      deleted++
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.cleanup.sweepOrphanUploads, {
        next: { cursor: page.continueCursor, from, to },
      })
    }
    return { deletedUploads: deleted }
  },
})
