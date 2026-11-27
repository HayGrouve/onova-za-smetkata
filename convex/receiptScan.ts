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
import { assertHostMayStartOcr, recordOcrStart } from './lib/ocrStart'
import { receiptsOfBill } from './lib/billReceipts'
import {
  BILL_RECEIPT_MESSAGES,
  MAX_RECEIPTS_PER_BILL,
} from '../shared/bill-receipts'

/** A scan still pending/processing after this long is treated as dead. */
const SCAN_IN_FLIGHT_MS = 3 * 60 * 1000

const editedItemValidator = v.object({
  name: v.string(),
  unitPriceCents: v.number(),
  quantity: v.number(),
})

export const startScan = mutation({
  args: {
    billId: v.id('bills'),
    receiptId: v.id('billReceipts'),
  },
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
    await assertHostMayStartOcr(ctx, owner, now)
    // Room to read every receipt of a full bill and retry each once.
    await assertRateLimit(
      ctx,
      `ocr:${args.billId}`,
      2 * MAX_RECEIPTS_PER_BILL,
      3_600_000,
    )
    const receipt = await ctx.db.get(args.receiptId)
    if (receipt?.billId !== bill._id) {
      throw new ConvexError(BILL_RECEIPT_MESSAGES.notFound)
    }

    // Only the newest scan of a bill is ever shown. An older one left behind
    // (a review closed without import) would come back once this one is
    // imported and reopen the review, possibly replacing lines.
    const earlier = await ctx.db
      .query('receiptScans')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    for (const scan of earlier) await ctx.db.delete(scan._id)

    const scanId = await ctx.db.insert('receiptScans', {
      billId: args.billId,
      receiptId: receipt._id,
      storageId: receipt.storageId,
      status: 'pending',
      createdAt: Date.now(),
    })

    await ctx.scheduler.runAfter(0, internal.receiptScanAction.runScan, {
      scanId,
    })

    await recordOcrStart(ctx, bill.ownerId, now)

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
    /**
     * `add` appends the lines; `replace` swaps every line on the bill;
     * `replaceReceipt` swaps only the lines imported from this scan's receipt
     * (a receipt scanned again).
     */
    mode: v.union(
      v.literal('add'),
      v.literal('replace'),
      v.literal('replaceReceipt'),
    ),
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

    // Removing a receipt deletes its scans, so a scan's receipt is still here.
    const receipt = scan.receiptId ? await ctx.db.get(scan.receiptId) : null
    if (args.mode === 'replaceReceipt' && !receipt) {
      throw new ConvexError(BILL_RECEIPT_MESSAGES.noReceiptToReplace)
    }

    const selectedIndexSet = new Set(args.selectedIndexes)
    const itemsToImport =
      args.items ??
      (scan.extractedItems ?? []).filter((_, index) =>
        selectedIndexSet.has(index),
      )
    if (itemsToImport.length === 0) {
      // „Замени“ with nothing selected would silently wipe every line.
      throw new ConvexError('Избери поне един артикул за импортиране.')
    }

    const validated = validateReceiptImportItems(itemsToImport)
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const existing = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', scan.billId))
      .collect()

    const replaced =
      args.mode === 'replace'
        ? existing
        : args.mode === 'replaceReceipt'
          ? existing.filter((item) => item.receiptId === receipt?._id)
          : []
    for (const item of replaced) {
      const assignments = await ctx.db
        .query('itemAssignments')
        .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
        .collect()
      for (const a of assignments) await ctx.db.delete(a._id)
      await ctx.db.delete(item._id)
    }
    const replacedIds = new Set(replaced.map((item) => item._id))
    const sortOrderOffset = nextSortOrder(
      existing.filter((item) => !replacedIds.has(item._id)),
    )

    for (const [index, item] of validated.data.entries()) {
      await ctx.db.insert('items', {
        billId: scan.billId,
        name: item.name,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        sortOrder: sortOrderOffset + index,
        ...(receipt ? { receiptId: receipt._id } : {}),
      })
    }

    const now = Date.now()
    if (args.mode === 'replace') {
      // Every other receipt's lines are gone with the rest.
      for (const other of await receiptsOfBill(ctx, scan.billId)) {
        if (other._id === receipt?._id) continue
        if (
          other.importedAt === undefined &&
          other.receiptTotalCents === undefined
        ) {
          continue
        }
        await ctx.db.patch(other._id, {
          importedAt: undefined,
          receiptTotalCents: undefined,
        })
      }
    }
    if (receipt) {
      await ctx.db.patch(receipt._id, {
        importedAt: now,
        receiptTotalCents: scan.receiptTotalCents,
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
    // The Host may dismiss the scan (or remove the receipt) mid-flight.
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
