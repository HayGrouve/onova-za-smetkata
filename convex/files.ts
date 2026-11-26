import { mutation, query } from './_generated/server'
import { v } from 'convex/values'
import { requireAuth, requireBillOwner } from './lib/auth'
import { assertRateLimit } from './lib/rateLimit'

export const generateUploadUrl = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const ownerId = await requireAuth(ctx)
    await requireBillOwner(ctx, args.billId)
    await assertRateLimit(ctx, `upload:${ownerId}`, 30, 60 * 60 * 1000)
    return await ctx.storage.generateUploadUrl()
  },
})

/**
 * Deprecated: the one photo clients from before several receipts per bill
 * show. The newest receipt, else the legacy bill photo. Use
 * `billReceipts.listReceipts`.
 */
export const getReceiptUrl = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    const newest = await ctx.db
      .query('billReceipts')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .order('desc')
      .first()
    const storageId = newest?.storageId ?? bill.receiptStorageId
    if (!storageId) return null
    return await ctx.storage.getUrl(storageId)
  },
})
