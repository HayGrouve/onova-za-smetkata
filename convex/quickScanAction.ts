'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { readReceiptPhoto } from './lib/readReceiptPhoto'

export const run = internalAction({
  args: { scanId: v.id('quickScans') },
  handler: async (ctx, args) => {
    const scan = await ctx.runQuery(internal.quickScan.getInternal, {
      scanId: args.scanId,
    })
    if (!scan) return

    const reading = await readReceiptPhoto(ctx, {
      storageId: scan.storageId,
      photo: scan.photo,
      onProcessing: () =>
        ctx.runMutation(internal.quickScan.markProcessing, {
          scanId: args.scanId,
        }),
    })

    if (!reading.ok) {
      await ctx.runMutation(internal.quickScan.markFailed, {
        scanId: args.scanId,
        errorMessage: reading.errorMessage,
      })
      return
    }
    await ctx.runMutation(internal.quickScan.markDone, {
      scanId: args.scanId,
      extractedRestaurantName: reading.restaurantName,
      extractedItems: reading.items,
      receiptTotalCents: reading.receiptTotalCents,
    })
  },
})
