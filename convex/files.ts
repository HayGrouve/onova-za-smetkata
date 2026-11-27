import { mutation } from './_generated/server'
import { v } from 'convex/values'
import { requireAuth, requireBillOwner } from './lib/auth'
import { assertRateLimit } from './lib/rateLimit'

export const generateUploadUrl = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const ownerId = await requireAuth(ctx)
    await requireBillOwner(ctx, args.billId)
    // A few bills' worth of receipts (up to 10 photos each) an hour.
    await assertRateLimit(ctx, `upload:${ownerId}`, 60, 60 * 60 * 1000)
    return await ctx.storage.generateUploadUrl()
  },
})
