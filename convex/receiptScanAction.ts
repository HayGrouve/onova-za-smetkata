'use node'

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { scanReceiptImage } from './lib/geminiReceipt'

export const runScan = internalAction({
  args: { scanId: v.id('receiptScans') },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      await ctx.runMutation(internal.receiptScan.markFailed, {
        scanId: args.scanId,
        errorMessage: 'AI не е конфигуриран (GEMINI_API_KEY)',
      })
      return
    }
    const scan = await ctx.runQuery(internal.receiptScan.getScanInternal, {
      scanId: args.scanId,
    })
    if (!scan) return

    await ctx.runMutation(internal.receiptScan.markProcessing, {
      scanId: args.scanId,
    })

    try {
      const blob = await ctx.storage.get(scan.storageId)
      if (!blob) throw new Error('Receipt image not found')
      const buffer = Buffer.from(await blob.arrayBuffer())
      const base64 = buffer.toString('base64')
      const mimeType = blob.type || 'image/jpeg'

      const result = await scanReceiptImage(apiKey, base64, mimeType)
      const filtered = result.items.filter(
        (i) => i.unitPriceCents > 0 && i.name.trim().length > 0,
      )
      const itemsTotalCents = filtered.reduce(
        (s, i) => s + i.unitPriceCents * i.quantity,
        0,
      )
      const totalsMismatch =
        result.receiptTotalCents !== undefined &&
        Math.abs(itemsTotalCents - result.receiptTotalCents) > 1

      await ctx.runMutation(internal.receiptScan.markDone, {
        scanId: args.scanId,
        extractedRestaurantName: result.restaurantName,
        extractedItems: filtered,
        receiptTotalCents: result.receiptTotalCents,
        itemsTotalCents,
        totalsMismatch,
      })
    } catch (e) {
      await ctx.runMutation(internal.receiptScan.markFailed, {
        scanId: args.scanId,
        errorMessage: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  },
})
