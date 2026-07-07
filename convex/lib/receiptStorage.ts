import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

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
