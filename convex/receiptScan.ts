import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { extractedItemValidator } from './schema'
import { requireBillOwner } from './lib/auth'
import { touchBill } from './lib/touchBill'

const editedItemValidator = v.object({
  name: v.string(),
  unitPriceCents: v.number(),
  quantity: v.number(),
})

export const startScan = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    if (!bill.receiptStorageId) {
      throw new Error('Няма прикачена снимка на бележка за тази сметка')
    }

    const scanId = await ctx.db.insert('receiptScans', {
      billId: args.billId,
      storageId: bill.receiptStorageId,
      status: 'pending',
      createdAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, internal.receiptScanAction.runScan, {
      scanId,
    })

    return scanId
  },
})

export const getLatestScan = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    return await ctx.db
      .query('receiptScans')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .order('desc')
      .first()
  },
})

export const importScannedItems = mutation({
  args: {
    scanId: v.id('receiptScans'),
    mode: v.union(v.literal('add'), v.literal('replace')),
    selectedIndexes: v.array(v.number()),
    updateRestaurantName: v.boolean(),
    restaurantName: v.optional(v.string()),
    items: v.optional(v.array(editedItemValidator)),
  },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId)
    if (!scan) throw new Error('Сканирането не е намерено')

    await requireBillOwner(ctx, scan.billId)

    const selectedIndexSet = new Set(args.selectedIndexes)
    const itemsToImport =
      args.items ??
      (scan.extractedItems ?? []).filter((_, index) =>
        selectedIndexSet.has(index),
      )

    const existing = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', scan.billId))
      .collect()

    let sortOrderOffset = existing.length

    if (args.mode === 'replace') {
      for (const item of existing) {
        const assignments = await ctx.db
          .query('itemAssignments')
          .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
          .collect()
        for (const a of assignments) await ctx.db.delete(a._id)
        await ctx.db.delete(item._id)
      }
      sortOrderOffset = 0
    }

    for (const [index, item] of itemsToImport.entries()) {
      await ctx.db.insert('items', {
        billId: scan.billId,
        name: item.name.trim(),
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        sortOrder: sortOrderOffset + index,
      })
    }

    if (args.updateRestaurantName) {
      const restaurantName = args.restaurantName ?? scan.extractedRestaurantName
      if (restaurantName !== undefined) {
        await ctx.db.patch(scan.billId, { restaurantName })
      }
    }

    await touchBill(ctx, scan.billId)
  },
})

export const dismissScan = mutation({
  args: { scanId: v.id('receiptScans') },
  handler: async (ctx, args) => {
    const scan = await ctx.db.get(args.scanId)
    if (!scan) return
    await requireBillOwner(ctx, scan.billId)
    await ctx.db.delete(args.scanId)
  },
})

export const getScanInternal = internalQuery({
  args: { scanId: v.id('receiptScans') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.scanId)
  },
})

export const markProcessing = internalMutation({
  args: { scanId: v.id('receiptScans') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, { status: 'processing' })
  },
})

export const markDone = internalMutation({
  args: {
    scanId: v.id('receiptScans'),
    extractedRestaurantName: v.optional(v.string()),
    extractedItems: v.array(extractedItemValidator),
    receiptTotalCents: v.optional(v.number()),
    itemsTotalCents: v.number(),
    totalsMismatch: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { scanId, ...rest } = args
    await ctx.db.patch(scanId, { status: 'done', ...rest })
  },
})

export const markFailed = internalMutation({
  args: {
    scanId: v.id('receiptScans'),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.scanId, {
      status: 'failed',
      errorMessage: args.errorMessage,
    })
  },
})

