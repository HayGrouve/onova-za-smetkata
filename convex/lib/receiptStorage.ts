import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/** A photo older than this was not uploaded for whatever is taking it now. */
const UPLOAD_MAX_AGE_MS = 10 * 60 * 1000

/** Whether a bill receipt, receipt scan or quick scan keeps this stored photo. */
export async function isPhotoHeld(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
): Promise<boolean> {
  const holder =
    (await ctx.db
      .query('quickScans')
      .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
      .first()) ??
    (await ctx.db
      .query('billReceipts')
      .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
      .first()) ??
    // The legacy single photo, until `backfill:moveLegacyReceipts` has run.
    (await ctx.db
      .query('bills')
      .withIndex('by_receiptStorageId', (q) =>
        q.eq('receiptStorageId', storageId),
      )
      .first()) ??
    (await ctx.db
      .query('receiptScans')
      .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
      .first())
  return holder !== null
}

/**
 * Photo ids come from the phone, and whatever takes one may later delete it
 * (a quick scan once read, a bill when its receipt is removed or the bill is
 * deleted). So only take a fresh upload nothing holds yet: never a bill's
 * receipt or a quick scan's photo. An upload nothing took within a day can
 * never be taken (this check refuses it), so the cleanup cron deletes it.
 */
export async function assertFreshUpload(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
  nowMs: number,
): Promise<void> {
  const photo = await ctx.db.system.get('_storage', storageId)
  const taken = await isPhotoHeld(ctx, storageId)
  if (!photo || taken || nowMs - photo._creationTime > UPLOAD_MAX_AGE_MS) {
    throw new ConvexError('Снимката не е качена. Опитай отново.')
  }
}

export async function deleteReceiptScansForBill(
  ctx: MutationCtx,
  billId: Id<'bills'>,
): Promise<void> {
  const scans = await ctx.db
    .query('receiptScans')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()

  for (const scan of scans) {
    await ctx.db.delete(scan._id)
  }
}

/** Delete a photo that may already be gone: the second delete must not throw. */
export async function deleteStoredPhoto(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
): Promise<void> {
  if (await ctx.db.system.get('_storage', storageId)) {
    await ctx.storage.delete(storageId)
  }
}
