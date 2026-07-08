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

export const getReceiptUrl = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    if (!bill.receiptStorageId) return null
    return await ctx.storage.getUrl(bill.receiptStorageId)
  },
})
