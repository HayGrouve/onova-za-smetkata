import { mutation, query } from './_generated/server'
import { ConvexError, v } from 'convex/values'
import { requireAuth, requireBillOwner } from './lib/auth'
import { assertBillCanFinalize } from './lib/validateBillForFinalize'
import { loadBillRelations } from './lib/billListSummary'
import {
  cleanupBillReceiptStorage,
  deleteReceiptScansForBill,
  deleteReceiptStorageFile,
  shouldDeleteReplacedReceiptStorage,
} from './lib/receiptStorage'
import { deleteGuestSessionsForBill } from './guestSessions'
import { isGuestSessionActive } from './lib/guestSession'
import { assertShareToken, toGuestVisibleBill } from './lib/guestAccess'
import {
  firstZodIssueMessage,
  parseBillMetadataPatch,
} from './lib/billMetadataSchema'
import { createShareToken } from './lib/shareToken'
import { calculateBillTotals } from './lib/billCalculations'
import { planHostParticipantOnBillCreate } from './lib/hostBillParticipant'
import { touchBill } from './lib/touchBill'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx)
    return await ctx.db
      .query('bills')
      .withIndex('by_ownerId_updatedAt', (q) => q.eq('ownerId', userId))
      .order('desc')
      .collect()
  },
})

export const listWithSummary = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const maxBills = Math.min(Math.max(args.limit ?? 100, 1), 200)
    const bills = await ctx.db
      .query('bills')
      .withIndex('by_ownerId_updatedAt', (q) => q.eq('ownerId', userId))
      .order('desc')
      .take(maxBills)

    return bills.map((bill) => ({
      bill,
      participantNames: bill.listParticipantNames ?? [],
      billTotalCents: bill.listBillTotalCents ?? 0,
      totalOutstandingCents:
        bill.status === 'draft' ? null : (bill.listOutstandingCents ?? 0),
    }))
  },
})

export const get = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    const relations = await loadBillRelations(ctx, args.billId)
    return { bill, ...relations }
  },
})

export const getForGuest = query({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bill = await assertShareToken(ctx, args.billId, args.shareToken)

    const { participants, items, assignments, payments } =
      await loadBillRelations(ctx, args.billId)

    let myPayments: typeof payments = []
    if (args.sessionToken) {
      const session = await ctx.db
        .query('guestSessions')
        .withIndex('by_sessionToken', (q) =>
          q.eq('sessionToken', args.sessionToken!),
        )
        .first()
      if (
        session &&
        session.billId === args.billId &&
        isGuestSessionActive(session.lastSeenAt)
      ) {
        myPayments = payments.filter(
          (payment) => payment.participantId === session.participantId,
        )
      }
    }

    const totals = calculateBillTotals({
      participants: participants.map((p) => ({
        id: p._id,
        sortOrder: p.sortOrder,
      })),
      items: items.map((i) => ({
        id: i._id,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
      })),
      assignments: assignments.map((a) => ({
        itemId: a.itemId,
        participantId: a.participantId,
        units: a.units,
      })),
      payments: payments.map((p) => ({
        participantId: p.participantId,
        amountCents: p.amountCents,
      })),
      tipCents: bill.tipCents ?? 0,
      hostParticipantId: bill.hostParticipantId,
    })
    const participantBalances = participants.map((p) => ({
      participantId: p._id,
      name: p.name,
      remainingCents: Math.max(
        0,
        totals.byParticipant[p._id]?.balanceCents ?? 0,
      ),
    }))

    return {
      bill: toGuestVisibleBill(bill),
      hostParticipantId: bill.hostParticipantId,
      participants,
      items,
      assignments,
      myPayments,
      participantBalances,
    }
  },
})

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireAuth(ctx)
    const owner = await ctx.db.get(ownerId)
    if (!owner) {
      throw new ConvexError('Потребителят не е намерен.')
    }

    const now = Date.now()
    const billId = await ctx.db.insert('bills', {
      ownerId,
      restaurantName: '',
      date: now,
      status: 'draft',
      shareToken: createShareToken(),
      listBillTotalCents: 0,
      listParticipantNames: [],
      createdAt: now,
      updatedAt: now,
    })

    const hostPlan = planHostParticipantOnBillCreate({
      username: owner.username,
      authName: owner.name,
    })
    const hostParticipantId = await ctx.db.insert('participants', {
      billId,
      name: hostPlan.name,
      sortOrder: hostPlan.sortOrder,
    })
    await ctx.db.patch(billId, { hostParticipantId })
    await touchBill(ctx, billId)

    return billId
  },
})

export const update = mutation({
  args: {
    billId: v.id('bills'),
    restaurantName: v.optional(v.string()),
    date: v.optional(v.number()),
    note: v.optional(v.string()),
    receiptStorageId: v.optional(v.id('_storage')),
    tipCents: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { billId, restaurantName, date, note, receiptStorageId, tipCents } =
      args

    const bill = await requireBillOwner(ctx, billId)

    const rawPatch = {
      ...(restaurantName !== undefined ? { restaurantName } : {}),
      ...(date !== undefined ? { date } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(tipCents !== undefined ? { tipCents } : {}),
    }

    const parsed = parseBillMetadataPatch(rawPatch)
    if (!parsed.success) {
      throw new ConvexError(
        firstZodIssueMessage(parsed.error, 'Невалидни данни за сметката'),
      )
    }

    const normalized = parsed.data

    const oldReceiptStorageId = shouldDeleteReplacedReceiptStorage(
      bill.receiptStorageId,
      receiptStorageId,
    )
      ? bill.receiptStorageId
      : undefined

    await ctx.db.patch(billId, {
      updatedAt: Date.now(),
      ...(normalized.restaurantName !== undefined
        ? { restaurantName: normalized.restaurantName }
        : {}),
      ...(normalized.date !== undefined ? { date: normalized.date } : {}),
      ...(note !== undefined ? { note: normalized.note } : {}),
      ...(receiptStorageId !== undefined ? { receiptStorageId } : {}),
      ...(normalized.tipCents !== undefined
        ? { tipCents: normalized.tipCents }
        : {}),
    })

    if (oldReceiptStorageId) {
      await cleanupBillReceiptStorage(ctx, billId, oldReceiptStorageId)
    }
  },
})

export const finalize = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)

    const { participants, items, assignments } = await loadBillRelations(
      ctx,
      args.billId,
    )

    assertBillCanFinalize({
      restaurantName: bill.restaurantName,
      participants: participants.map((p) => ({
        id: p._id,
        sortOrder: p.sortOrder,
      })),
      items: items.map((i) => ({
        id: i._id,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
      })),
      assignments: assignments.map((a) => ({
        itemId: a.itemId,
        participantId: a.participantId,
        units: a.units,
      })),
    })

    await ctx.db.patch(args.billId, {
      status: 'final',
      updatedAt: Date.now(),
    })
    await deleteGuestSessionsForBill(ctx, args.billId)
  },
})

export const rotateShareToken = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    const shareToken = createShareToken()
    await ctx.db.patch(args.billId, {
      shareToken,
      updatedAt: Date.now(),
    })
    return { shareToken }
  },
})

export const remove = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)

    const receiptStorageId = bill.receiptStorageId

    await deleteReceiptScansForBill(ctx, args.billId)
    await deleteGuestSessionsForBill(ctx, args.billId)

    const { participants, items, payments } = await loadBillRelations(
      ctx,
      args.billId,
    )

    for (const item of items) {
      const assignments = await ctx.db
        .query('itemAssignments')
        .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
        .collect()
      for (const a of assignments) await ctx.db.delete(a._id)
      await ctx.db.delete(item._id)
    }
    for (const p of participants) await ctx.db.delete(p._id)
    for (const pay of payments) await ctx.db.delete(pay._id)
    await ctx.db.delete(args.billId)

    if (receiptStorageId) {
      await deleteReceiptStorageFile(ctx, receiptStorageId)
    }
  },
})
