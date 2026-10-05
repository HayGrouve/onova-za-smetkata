import { ConvexError, v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { extractedItemValidator } from './schema'
import { assertBillDraft } from './lib/assertBillDraft'
import { requireBillOwner } from './lib/auth'
import { restaurantNameSchema } from '../shared/validation/fields'
import { validateReceiptImportItems } from '../shared/receipt-import-schema'
import { assertRateLimit } from './lib/rateLimit'
import { touchBill } from './lib/touchBill'
import { nextSortOrder } from '../shared/sort-order'
import {
  assertOcrStartQuota,
  formatUsageMonthKey,
  incrementUsageCount,
  usageCounterKey,
} from './lib/hostTier'

const OCR_SCANS_PER_HOST_PER_HOUR = 20

/** A scan still pending/processing after this long is treated as dead. */
const SCAN_IN_FLIGHT_MS = 3 * 60 * 1000

const editedItemValidator = v.object({
  name: v.string(),
  unitPriceCents: v.number(),
  quantity: v.number(),
})

export const startScan = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    assertBillDraft(bill)

    const owner = await ctx.db.get(bill.ownerId)
    if (!owner) {
      throw new ConvexError('Потребителят не е намерен.')
    }

    const latest = await ctx.db
      .query('receiptScans')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .order('desc')
      .first()
    const inFlight =
      (latest?.status === 'pending' || latest?.status === 'processing') &&
      Date.now() - latest.createdAt < SCAN_IN_FLIGHT_MS
    if (inFlight) {
      // A second tap must not pay for (or count against quota) a second scan.
      // A scan whose action died is stale after a while and blocks nothing.
      throw new ConvexError('Бележката вече се разпознава.')
    }

    const now = Date.now()
    await assertOcrStartQuota(ctx, owner, bill.ownerId, now)
    await assertRateLimit(ctx, `ocr:${args.billId}`, 10, 3_600_000)
    // Per Host too: bills are free to create, so a per-bill cap alone does not
    // bound Gemini spend while every Host has Pro limits.
    await assertRateLimit(
      ctx,
      `ocr:user:${bill.ownerId}`,
      OCR_SCANS_PER_HOST_PER_HOUR,
      3_600_000,
    )
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

    const monthKey = formatUsageMonthKey(now)
    await incrementUsageCount(
      ctx,
      usageCounterKey(bill.ownerId, 'ocr', monthKey),
      now,
    )

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
    // The scan is consumed by its import: a second tap finds nothing, so the
    // same lines cannot be added twice.
    const scan = await ctx.db.get(args.scanId)
    if (!scan) throw new ConvexError('Сканирането не е намерено.')

    const bill = await requireBillOwner(ctx, scan.billId)
    assertBillDraft(bill)

    const selectedIndexSet = new Set(args.selectedIndexes)
    const itemsToImport =
      args.items ??
      (scan.extractedItems ?? []).filter((_, index) =>
        selectedIndexSet.has(index),
      )
    if (itemsToImport.length === 0) {
      // „Замени“ with nothing selected would silently wipe every line.
      throw new ConvexError('Изберете поне един артикул за импортиране.')
    }

    const validated = validateReceiptImportItems(itemsToImport)
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const existing = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', scan.billId))
      .collect()

    let sortOrderOffset = nextSortOrder(existing)

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

    for (const [index, item] of validated.data.entries()) {
      await ctx.db.insert('items', {
        billId: scan.billId,
        name: item.name,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        sortOrder: sortOrderOffset + index,
      })
    }

    if (args.updateRestaurantName) {
      const restaurantName = args.restaurantName ?? scan.extractedRestaurantName
      if (restaurantName !== undefined) {
        const parsed = restaurantNameSchema().safeParse(restaurantName)
        if (!parsed.success) {
          throw new ConvexError(
            parsed.error.issues[0]?.message ?? 'Невалидно име на ресторант',
          )
        }
        await ctx.db.patch(scan.billId, { restaurantName: parsed.data })
      }
    }

    await ctx.db.delete(scan._id)
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
    const scan = await ctx.db.get(args.scanId)
    if (!scan) return null
    // Size and type let the action refuse a photo without downloading it.
    const photo = await ctx.db.system.get('_storage', scan.storageId)
    return {
      ...scan,
      photo: photo
        ? { size: photo.size, contentType: photo.contentType }
        : null,
    }
  },
})

export const markProcessing = internalMutation({
  args: { scanId: v.id('receiptScans') },
  handler: async (ctx, args) => {
    // The Host may dismiss the scan (or replace the photo) mid-flight.
    if (!(await ctx.db.get(args.scanId))) return
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
    if (!(await ctx.db.get(scanId))) return
    await ctx.db.patch(scanId, { status: 'done', ...rest })
  },
})

export const markFailed = internalMutation({
  args: {
    scanId: v.id('receiptScans'),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    if (!(await ctx.db.get(args.scanId))) return
    await ctx.db.patch(args.scanId, {
      status: 'failed',
      errorMessage: args.errorMessage,
    })
  },
})
