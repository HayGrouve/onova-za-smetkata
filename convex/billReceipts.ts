import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { assertBillDraft } from './lib/assertBillDraft'
import { requireBillOwner } from './lib/auth'
import { addBillReceipt, receiptsOfBill } from './lib/billReceipts'
import { deleteStoredPhoto } from './lib/receiptStorage'
import { touchBill } from './lib/touchBill'

/** Attach one more receipt photo (a fresh upload) to a draft bill. */
export const addReceipt = mutation({
  args: { billId: v.id('bills'), storageId: v.id('_storage') },
  returns: v.id('billReceipts'),
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    assertBillDraft(bill)
    const receiptId = await addBillReceipt(ctx, bill._id, args.storageId)
    await touchBill(ctx, bill._id)
    return receiptId
  },
})

/**
 * Take a receipt photo off the bill. Its lines stay on the bill as if typed
 * in; its scans go, so a read still running for it finds nothing to write to.
 * A second tap finds nothing and returns.
 */
export const removeReceipt = mutation({
  args: { receiptId: v.id('billReceipts') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.receiptId)
    if (!receipt) return null
    const bill = await requireBillOwner(ctx, receipt.billId)
    assertBillDraft(bill)

    // Every scan of this receipt read its photo, legacy scans included.
    const scans = await ctx.db
      .query('receiptScans')
      .withIndex('by_storageId', (q) => q.eq('storageId', receipt.storageId))
      .collect()
    for (const scan of scans) await ctx.db.delete(scan._id)

    const lines = await ctx.db
      .query('items')
      .withIndex('by_receiptId', (q) => q.eq('receiptId', receipt._id))
      .collect()
    for (const line of lines) {
      await ctx.db.patch(line._id, { receiptId: undefined })
    }

    await ctx.db.delete(receipt._id)
    await deleteStoredPhoto(ctx, receipt.storageId)
    await touchBill(ctx, bill._id)
    return null
  },
})

/** The bill's receipt photos, oldest first, for the Host. */
export const listReceipts = query({
  args: { billId: v.id('bills') },
  returns: v.array(
    v.object({
      _id: v.id('billReceipts'),
      createdAt: v.number(),
      importedAt: v.optional(v.number()),
      receiptTotalCents: v.optional(v.number()),
      url: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    const receipts = await receiptsOfBill(ctx, args.billId)
    return await Promise.all(
      receipts.map(async (receipt) => ({
        _id: receipt._id,
        createdAt: receipt.createdAt,
        ...(receipt.importedAt !== undefined
          ? { importedAt: receipt.importedAt }
          : {}),
        ...(receipt.receiptTotalCents !== undefined
          ? { receiptTotalCents: receipt.receiptTotalCents }
          : {}),
        url: await ctx.storage.getUrl(receipt.storageId),
      })),
    )
  },
})
