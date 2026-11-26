import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  BILL_RECEIPT_MESSAGES,
  MAX_RECEIPTS_PER_BILL,
} from '../../shared/bill-receipts'
import { assertFreshUpload, deleteStoredPhoto } from './receiptStorage'

/** The bill's receipt photos, oldest first. At most a cap's worth. */
export async function receiptsOfBill(
  ctx: QueryCtx,
  billId: Id<'bills'>,
): Promise<Doc<'billReceipts'>[]> {
  return await ctx.db
    .query('billReceipts')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
}

/**
 * Attach a fresh upload to the bill as one more receipt. Callers check the
 * Host owns the draft bill.
 */
export async function addBillReceipt(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  storageId: Id<'_storage'>,
): Promise<Id<'billReceipts'>> {
  const now = Date.now()
  const held = await ctx.db
    .query('billReceipts')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .take(MAX_RECEIPTS_PER_BILL)
  if (held.length >= MAX_RECEIPTS_PER_BILL) {
    throw new ConvexError(BILL_RECEIPT_MESSAGES.tooMany)
  }
  await assertFreshUpload(ctx, storageId, now)
  return await ctx.db.insert('billReceipts', {
    billId,
    storageId,
    createdAt: now,
  })
}

/** Whether the bill already holds this photo, as a receipt or the legacy one. */
export async function billHoldsPhoto(
  ctx: QueryCtx,
  bill: Doc<'bills'>,
  storageId: Id<'_storage'>,
): Promise<boolean> {
  if (bill.receiptStorageId === storageId) return true
  const receipt = await ctx.db
    .query('billReceipts')
    .withIndex('by_storageId', (q) => q.eq('storageId', storageId))
    .first()
  return receipt?.billId === bill._id
}

/**
 * The photo a scan reads when the phone names no receipt (clients from before
 * several receipts): the newest one not imported yet, else the newest at all, else
 * the legacy bill photo. Null when the bill has no photo at all.
 */
export async function defaultScanPhoto(
  ctx: QueryCtx,
  bill: Doc<'bills'>,
): Promise<{
  receiptId?: Id<'billReceipts'>
  storageId: Id<'_storage'>
} | null> {
  const receipts = await receiptsOfBill(ctx, bill._id)
  // An old client scans right after attaching its photo: the newest one.
  const picked =
    [...receipts]
      .reverse()
      .find((receipt) => receipt.importedAt === undefined) ?? receipts.at(-1)
  if (picked) return { receiptId: picked._id, storageId: picked.storageId }
  if (bill.receiptStorageId) return { storageId: bill.receiptStorageId }
  return null
}

/** Delete every receipt row of a bill being deleted, with its photo. */
export async function deleteReceiptsOfBill(
  ctx: MutationCtx,
  billId: Id<'bills'>,
): Promise<void> {
  for (const receipt of await receiptsOfBill(ctx, billId)) {
    await ctx.db.delete(receipt._id)
    await deleteStoredPhoto(ctx, receipt.storageId)
  }
}
