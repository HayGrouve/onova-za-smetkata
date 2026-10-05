import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import type { Doc } from './_generated/dataModel'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { MutationCtx } from './_generated/server'
import { extractedItemValidator } from './schema'
import { getOptionalAuthUserId, requireAuth } from './lib/auth'
import { assertOcrStartQuota } from './lib/hostTier'
import { assertHostMayStartOcr, recordOcrStart } from './lib/ocrStart'
import { assertRateLimit } from './lib/rateLimit'
import { deleteStoredPhoto } from './lib/receiptStorage'

/**
 * Receipt scans for a quick bill: no bill row, no participants. The Host's
 * phone uploads the photo, starts a scan, takes the lines and discards it.
 */

/** A photo older than this was not uploaded for the scan being started. */
const QUICK_UPLOAD_MAX_AGE_MS = 10 * 60 * 1000

/** The photo is only needed until Gemini has read it. */
async function dropPhoto(ctx: MutationCtx, scan: Doc<'quickScans'>) {
  if (!scan.storageId) return
  await deleteStoredPhoto(ctx, scan.storageId)
  await ctx.db.patch(scan._id, { storageId: undefined })
}

/** Why the Host may not start a scan now, from the quota and hourly cap. */
async function startRefusal(
  ctx: MutationCtx,
  owner: Doc<'users'>,
  now: number,
): Promise<{ message: string; quota: boolean } | null> {
  try {
    // Both checks throw before writing anything.
    await assertHostMayStartOcr(ctx, owner, now)
    return null
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error
    const data: unknown = error.data
    if (typeof data === 'string') return { message: data, quota: false }
    const code = isRecord(data) ? data.code : undefined
    const message = isRecord(data) ? data.message : undefined
    if (code === 'QUOTA_OCR' && typeof message === 'string') {
      return { message, quota: true }
    }
    throw error
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const ownerId = await requireAuth(ctx)
    const owner = await ctx.db.get(ownerId)
    if (!owner) throw new ConvexError('Потребителят не е намерен.')
    // Over the quota the photo would only be uploaded to be thrown away.
    await assertOcrStartQuota(ctx, owner, ownerId, Date.now())
    await assertRateLimit(ctx, `upload:quick:${ownerId}`, 30, 60 * 60 * 1000)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Start reading a photo the phone just uploaded. A refusal (monthly quota,
 * hourly cap) deletes the photo and comes back as a value: thrown, it would
 * roll the delete back and leave the photo in storage for good.
 */
export const start = mutation({
  args: { storageId: v.id('_storage') },
  returns: v.union(
    v.object({ ok: v.literal(true), scanId: v.id('quickScans') }),
    v.object({ ok: v.literal(false), message: v.string(), quota: v.boolean() }),
  ),
  handler: async (ctx, args) => {
    const ownerId = await requireAuth(ctx)
    const owner = await ctx.db.get(ownerId)
    if (!owner) throw new ConvexError('Потребителят не е намерен.')

    // The scan deletes its photo: only a fresh upload no scan has taken yet,
    // never a file that belongs to something else (a bill's receipt).
    const now = Date.now()
    const photo = await ctx.db.system.get('_storage', args.storageId)
    const taken =
      (await ctx.db
        .query('quickScans')
        .withIndex('by_storageId', (q) => q.eq('storageId', args.storageId))
        .first()) ??
      (await ctx.db
        .query('bills')
        .withIndex('by_receiptStorageId', (q) =>
          q.eq('receiptStorageId', args.storageId),
        )
        .first())
    if (
      !photo ||
      taken ||
      now - photo._creationTime > QUICK_UPLOAD_MAX_AGE_MS
    ) {
      throw new ConvexError('Снимката не е качена. Опитайте отново.')
    }

    const refusal = await startRefusal(ctx, owner, now)
    if (refusal) {
      await deleteStoredPhoto(ctx, args.storageId)
      return { ok: false as const, ...refusal }
    }

    const scanId = await ctx.db.insert('quickScans', {
      ownerId,
      storageId: args.storageId,
      status: 'pending',
      createdAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.quickScanAction.run, { scanId })
    await recordOcrStart(ctx, ownerId, now)
    return { ok: true as const, scanId }
  },
})

export const get = query({
  args: { scanId: v.id('quickScans') },
  returns: v.union(
    v.null(),
    v.object({
      status: v.union(
        v.literal('pending'),
        v.literal('processing'),
        v.literal('failed'),
        v.literal('done'),
      ),
      restaurantName: v.optional(v.string()),
      items: v.array(extractedItemValidator),
      receiptTotalCents: v.optional(v.number()),
      errorMessage: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const ownerId = await getOptionalAuthUserId(ctx)
    const scan = await ctx.db.get(args.scanId)
    if (!ownerId || !scan || scan.ownerId !== ownerId) return null
    return {
      status: scan.status,
      restaurantName: scan.extractedRestaurantName,
      items: scan.extractedItems ?? [],
      receiptTotalCents: scan.receiptTotalCents,
      errorMessage: scan.errorMessage,
    }
  },
})

/** The phone has the lines (or gave up): nothing of the scan stays behind. */
export const discard = mutation({
  args: { scanId: v.id('quickScans') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const ownerId = await requireAuth(ctx)
    const scan = await ctx.db.get(args.scanId)
    if (!scan || scan.ownerId !== ownerId) return null
    await dropPhoto(ctx, scan)
    await ctx.db.delete(scan._id)
    return null
  },
})

export const getInternal = internalQuery({
  args: { scanId: v.id('quickScans') },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId)
    if (!scan?.storageId) return null
    // Size and type let the action refuse a photo without downloading it.
    const photo = await ctx.db.system.get('_storage', scan.storageId)
    return {
      storageId: scan.storageId,
      photo: photo
        ? { size: photo.size, contentType: photo.contentType }
        : null,
    }
  },
})

export const markProcessing = internalMutation({
  args: { scanId: v.id('quickScans') },
  handler: async (ctx, args) => {
    // The phone may discard the scan mid-flight.
    if (!(await ctx.db.get(args.scanId))) return
    await ctx.db.patch(args.scanId, { status: 'processing' })
  },
})

export const markDone = internalMutation({
  args: {
    scanId: v.id('quickScans'),
    extractedRestaurantName: v.optional(v.string()),
    extractedItems: v.array(extractedItemValidator),
    receiptTotalCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { scanId, ...rest } = args
    const scan = await ctx.db.get(scanId)
    if (!scan) return
    await ctx.db.patch(scanId, { status: 'done', ...rest })
    await dropPhoto(ctx, scan)
  },
})

export const markFailed = internalMutation({
  args: { scanId: v.id('quickScans'), errorMessage: v.string() },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId)
    if (!scan) return
    await ctx.db.patch(args.scanId, {
      status: 'failed',
      errorMessage: args.errorMessage,
    })
    await dropPhoto(ctx, scan)
  },
})
