import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/** A photo older than this was not uploaded for whatever is taking it now. */
const UPLOAD_MAX_AGE_MS = 10 * 60 * 1000

/**
 * Photo ids come from the phone, and whatever takes one may later delete it
 * (a quick scan once read, a bill when its receipt is replaced or the bill is
 * deleted). So only take a fresh upload nothing holds yet: never a bill's
 * receipt or a quick scan's photo.
 */
export async function assertFreshUpload(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
  nowMs: number,
): Promise<void> {
  const photo = await ctx.db.system.get('_storage', storageId)
  const taken =
    (await ctx.db
      .query('quickScans')
      .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
      .first()) ??
    (await ctx.db
      .query('bills')
      .withIndex('by_receiptStorageId', (q) =>
        q.eq('receiptStorageId', storageId),
      )
      .first())
  if (!photo || taken || nowMs - photo._creationTime > UPLOAD_MAX_AGE_MS) {
    throw new ConvexError('Снимката не е качена. Опитайте отново.')
  }
}

export function shouldDeleteReplacedReceiptStorage(
  currentStorageId: Id<'_storage'> | undefined,
  nextStorageId: Id<'_storage'> | undefined,
): currentStorageId is Id<'_storage'> {
  return (
    nextStorageId !== undefined &&
    currentStorageId !== undefined &&
    currentStorageId !== nextStorageId
  )
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

export async function deleteReceiptStorageFile(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
): Promise<void> {
  await ctx.storage.delete(storageId)
}

export async function cleanupBillReceiptStorage(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  storageId: Id<'_storage'>,
): Promise<void> {
  await deleteReceiptScansForBill(ctx, billId)
  await deleteReceiptStorageFile(ctx, storageId)
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
