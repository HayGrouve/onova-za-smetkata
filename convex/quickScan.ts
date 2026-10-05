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

/**
 * Receipt scans for a quick bill: no bill row, no participants. The Host's
 * phone uploads the photo, starts a scan, takes the lines and discards it.
 */

/** The photo is only needed until Gemini has read it. */
async function dropPhoto(ctx: MutationCtx, scan: Doc<'quickScans'>) {
  if (!scan.storageId) return
  await ctx.storage.delete(scan.storageId)
  await ctx.db.patch(scan._id, { storageId: undefined })
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
    await assertRateLimit(ctx, `upload:${ownerId}`, 30, 60 * 60 * 1000)
    return await ctx.storage.generateUploadUrl()
  },
})

export const start = mutation({
  args: { storageId: v.id('_storage') },
  returns: v.id('quickScans'),
  handler: async (ctx, args) => {
    const ownerId = await requireAuth(ctx)
    const owner = await ctx.db.get(ownerId)
    if (!owner) throw new ConvexError('Потребителят не е намерен.')
    if (!(await ctx.db.system.get('_storage', args.storageId))) {
      throw new ConvexError('Снимката не е качена. Опитайте отново.')
    }

    const now = Date.now()
    await assertHostMayStartOcr(ctx, owner, now)

    const scanId = await ctx.db.insert('quickScans', {
      ownerId,
      storageId: args.storageId,
      status: 'pending',
      createdAt: now,
    })
    await ctx.scheduler.runAfter(0, internal.quickScanAction.run, { scanId })
    await recordOcrStart(ctx, ownerId, now)
    return scanId
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
