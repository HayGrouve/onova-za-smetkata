import { ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { requireBillOwner } from './lib/auth'
import {
  COMBINED_PAYMENT_MESSAGES,
  isAwaitingHostConfirmation,
  isSoloPaymentRequest,
  participantRemainingCents,
  validateCombinedPaymentConfirm,
  validateCombinedPaymentCreate,
  validateInitiateTransfer,
  validateSoloPaymentCreate,
} from './lib/combinedPayment'
import { validatePaymentAdd } from './lib/paymentAmountSchema'
import { touchBill } from './lib/touchBill'
import { assertShareToken } from './lib/guestAccess'
import { GUEST_FLOW_MESSAGES } from './lib/guestFlowMessages'
import { requireGuestSession } from './lib/requireGuestSession'
import { calculateBillTotals, type BillTotals } from './lib/billCalculations'

async function loadBillTotalsForCombinedPay(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
): Promise<BillTotals> {
  const items = await ctx.db
    .query('items')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
  const participants = await ctx.db
    .query('participants')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
  const assignments = await ctx.db
    .query('itemAssignments')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
  const payments = await ctx.db
    .query('payments')
    .withIndex('by_billId', (q) => q.eq('billId', billId))
    .collect()
  const bill = await ctx.db.get(billId)
  if (!bill) {
    throw new ConvexError('Сметката не е намерена.')
  }

  return calculateBillTotals({
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
  })
}

export const getPendingForGuest = query({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)
    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) return null

    const pending = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_guestSessionId', (q) =>
        q.eq('guestSessionId', session._id),
      )
      .collect()

    return (
      pending.find((r) => r.billId === args.billId && r.status === 'pending') ??
      null
    )
  },
})

export const listPendingForBill = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    const pending = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_billId_status', (q) =>
        q.eq('billId', args.billId).eq('status', 'pending'),
      )
      .collect()
    return pending.filter((request) => isAwaitingHostConfirmation(request))
  },
})

export const getPendingCoverForGuest = query({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)
    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) return null

    const pending = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_billId_status', (q) =>
        q.eq('billId', args.billId).eq('status', 'pending'),
      )
      .collect()

    const cover = pending.find(
      (request) =>
        request.coveredParticipantId != null &&
        request.coveredParticipantId === session.participantId,
    )
    if (!cover) return null

    const payer = await ctx.db.get(cover.payerParticipantId)
    return {
      requestId: cover._id,
      payerParticipantId: cover.payerParticipantId,
      payerName: payer?.name ?? 'Участник',
      coveredAmountCents: cover.coveredAmountCents,
      totalCents: cover.totalCents,
    }
  },
})

export const create = mutation({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.string(),
    coveredParticipantId: v.id('participants'),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)

    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
    }

    const { sessionId } = await requireGuestSession(ctx, {
      billId: args.billId,
      participantId: session.participantId,
      sessionToken: args.sessionToken,
    })

    const covered = await ctx.db.get(args.coveredParticipantId)
    if (!covered || covered.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.participantNotOnBill)
    }

    const totals = await loadBillTotalsForCombinedPay(ctx, args.billId)

    const existingForSession = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_guestSessionId', (q) => q.eq('guestSessionId', sessionId))
      .collect()
    const hasPendingForSession = existingForSession.some(
      (r) => r.billId === args.billId && r.status === 'pending',
    )

    const billPending = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_billId_status', (q) =>
        q.eq('billId', args.billId).eq('status', 'pending'),
      )
      .collect()
    const coveredHasPending = billPending.some(
      (r) => r.coveredParticipantId === args.coveredParticipantId,
    )

    const validated = validateCombinedPaymentCreate(
      { coveredParticipantId: args.coveredParticipantId },
      {
        payerParticipantId: session.participantId,
        hasPendingForSession,
        coveredHasPending,
        totals,
      },
    )
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const requestId = await ctx.db.insert('combinedPaymentRequests', {
      billId: args.billId,
      payerParticipantId: session.participantId,
      coveredParticipantId: args.coveredParticipantId,
      payerAmountCents: validated.payerAmountCents,
      coveredAmountCents: validated.coveredAmountCents,
      totalCents: validated.totalCents,
      status: 'pending',
      guestSessionId: sessionId,
      createdAt: Date.now(),
    })

    return { requestId, totalCents: validated.totalCents }
  },
})

export const createSolo = mutation({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await assertShareToken(ctx, args.billId, args.shareToken)

    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
    }

    const { sessionId } = await requireGuestSession(ctx, {
      billId: args.billId,
      participantId: session.participantId,
      sessionToken: args.sessionToken,
    })

    const totals = await loadBillTotalsForCombinedPay(ctx, args.billId)
    const existingForSession = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_guestSessionId', (q) => q.eq('guestSessionId', sessionId))
      .collect()
    const hasPendingForSession = existingForSession.some(
      (r) => r.billId === args.billId && r.status === 'pending',
    )

    const validated = validateSoloPaymentCreate({
      payerParticipantId: session.participantId,
      hasPendingForSession,
      totals,
    })
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const now = Date.now()
    const requestId = await ctx.db.insert('combinedPaymentRequests', {
      billId: args.billId,
      payerParticipantId: session.participantId,
      payerAmountCents: validated.payerAmountCents,
      coveredAmountCents: 0,
      totalCents: validated.totalCents,
      status: 'pending',
      guestSessionId: sessionId,
      createdAt: now,
      transferInitiatedAt: now,
    })

    return { requestId, totalCents: validated.totalCents }
  },
})

export const initiateTransfer = mutation({
  args: {
    billId: v.id('bills'),
    sessionToken: v.string(),
    requestId: v.id('combinedPaymentRequests'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
    }

    const request = await ctx.db.get(args.requestId)
    if (
      !request ||
      request.billId !== args.billId ||
      request.guestSessionId !== session._id
    ) {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotFound)
    }

    const validated = validateInitiateTransfer(request)
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    await ctx.db.patch(request._id, { transferInitiatedAt: Date.now() })
  },
})

export const cancel = mutation({
  args: {
    billId: v.id('bills'),
    sessionToken: v.string(),
    requestId: v.id('combinedPaymentRequests'),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('guestSessions')
      .withIndex('by_sessionToken', (q) =>
        q.eq('sessionToken', args.sessionToken),
      )
      .first()
    if (!session || session.billId !== args.billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.sessionExpired)
    }

    const request = await ctx.db.get(args.requestId)
    if (
      !request ||
      request.billId !== args.billId ||
      request.guestSessionId !== session._id
    ) {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotFound)
    }
    if (request.status !== 'pending') {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotPending)
    }

    await ctx.db.patch(request._id, {
      status: 'cancelled',
      resolvedAt: Date.now(),
    })
  },
})

export const reject = mutation({
  args: {
    billId: v.id('bills'),
    requestId: v.id('combinedPaymentRequests'),
  },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    const request = await ctx.db.get(args.requestId)
    if (!request || request.billId !== args.billId) {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotFound)
    }
    if (request.status !== 'pending') {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotPending)
    }
    await ctx.db.patch(request._id, {
      status: 'rejected',
      resolvedAt: Date.now(),
    })
  },
})

export const confirm = mutation({
  args: {
    billId: v.id('bills'),
    requestId: v.id('combinedPaymentRequests'),
  },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)

    const request = await ctx.db.get(args.requestId)
    if (!request || request.billId !== args.billId) {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotFound)
    }
    if (request.status !== 'pending') {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotPending)
    }
    if (request.transferInitiatedAt == null) {
      throw new ConvexError(COMBINED_PAYMENT_MESSAGES.transferNotInitiated)
    }

    const totals = await loadBillTotalsForCombinedPay(ctx, args.billId)
    const payerRemaining = participantRemainingCents(
      totals,
      request.payerParticipantId,
    )
    const coveredRemaining = request.coveredParticipantId
      ? participantRemainingCents(totals, request.coveredParticipantId)
      : 0

    const validated = validateCombinedPaymentConfirm(
      {
        payerAmountCents: request.payerAmountCents,
        coveredAmountCents: request.coveredAmountCents,
      },
      {
        payerRemainingCents: payerRemaining,
        coveredRemainingCents: coveredRemaining,
      },
    )
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const note = COMBINED_PAYMENT_MESSAGES.combinedPaymentNote
    const now = Date.now()

    const payments = await ctx.db
      .query('payments')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    const entries = isSoloPaymentRequest(request)
      ? [
          {
            participantId: request.payerParticipantId,
            amountCents: request.payerAmountCents,
          },
        ]
      : [
          {
            participantId: request.payerParticipantId,
            amountCents: request.payerAmountCents,
          },
          {
            participantId: request.coveredParticipantId!,
            amountCents: request.coveredAmountCents,
          },
        ]

    for (const entry of entries) {
      const owedCents =
        totals.byParticipant[entry.participantId]?.owedCents ?? 0
      const paidCents = payments
        .filter((payment) => payment.participantId === entry.participantId)
        .reduce((sum, payment) => sum + payment.amountCents, 0)
      const paymentValidated = validatePaymentAdd(
        { amountCents: entry.amountCents, note },
        { owedCents, paidCents },
      )
      if (!paymentValidated.ok) {
        throw new ConvexError(paymentValidated.message)
      }
      await ctx.db.insert('payments', {
        billId: args.billId,
        participantId: entry.participantId,
        amountCents: paymentValidated.data.amountCents,
        note: paymentValidated.data.note,
        paidAt: now,
      })
    }

    await ctx.db.patch(request._id, {
      status: 'confirmed',
      resolvedAt: now,
    })
    await touchBill(ctx, args.billId)
  },
})
