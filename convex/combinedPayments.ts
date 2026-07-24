import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireBillOwner } from './lib/auth'
import {
  COMBINED_PAYMENT_MESSAGES,
  getCoveredAmountsFromRequest,
  getCoveredParticipantIds,
  isAwaitingHostConfirmation,
  isSoloPaymentRequest,
  participantRemainingCents,
  validateCombinedPaymentConfirm,
  validateCombinedPaymentCreate,
  validateInitiateTransfer,
  validateSoloPaymentCreate,
  validateUpdateCovered,
} from './lib/combinedPayment'
import { validatePaymentAdd } from './lib/paymentAmountSchema'
import { touchBill } from './lib/touchBill'
import { assertShareToken } from './lib/guestAccess'
import { assertBillDraft } from './lib/assertBillDraft'
import { GUEST_FLOW_MESSAGES } from './lib/guestFlowMessages'
import { requireGuestSession } from './lib/requireGuestSession'
import { calculateBillTotals } from './lib/billCalculations'
import type { BillTotals } from './lib/billCalculations'
import { toBillCalculationSnapshot } from './lib/billCalculationSnapshot'
import { loadBillRelations } from './lib/billListSummary'

async function loadBillTotalsForCombinedPay(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
): Promise<BillTotals> {
  const bill = await ctx.db.get(billId)
  if (!bill) {
    throw new ConvexError('Сметката не е намерена.')
  }

  const relations = await loadBillRelations(ctx, billId)
  const { calculationInput } = toBillCalculationSnapshot(relations, {
    tipCents: bill.tipCents ?? 0,
    hostParticipantId: bill.hostParticipantId,
  })

  return calculateBillTotals(calculationInput)
}

function buildCoveredPendingIds(
  pending: Doc<'combinedPaymentRequests'>[],
  excludeRequestId?: Id<'combinedPaymentRequests'>,
): Set<string> {
  const ids = new Set<string>()
  for (const request of pending) {
    if (excludeRequestId && request._id === excludeRequestId) continue
    if (request.status !== 'pending') continue
    for (const id of getCoveredParticipantIds(request)) {
      ids.add(id)
    }
  }
  return ids
}

async function validateCoveredParticipantsOnBill(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
  coveredParticipantIds: Id<'participants'>[],
) {
  for (const coveredId of coveredParticipantIds) {
    const covered = await ctx.db.get(coveredId)
    if (!covered || covered.billId !== billId) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.participantNotOnBill)
    }
  }
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

    const cover = pending.find((request) =>
      getCoveredParticipantIds(request).includes(session.participantId),
    )
    if (!cover) return null

    const payer = await ctx.db.get(cover.payerParticipantId)
    const coveredAmounts = getCoveredAmountsFromRequest(cover)
    return {
      requestId: cover._id,
      payerParticipantId: cover.payerParticipantId,
      payerName: payer?.name ?? 'Участник',
      coveredAmountCents:
        coveredAmounts[session.participantId] ?? cover.coveredAmountCents,
      totalCents: cover.totalCents,
    }
  },
})

export const create = mutation({
  args: {
    billId: v.id('bills'),
    shareToken: v.string(),
    sessionToken: v.string(),
    coveredParticipantIds: v.array(v.id('participants')),
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

    const bill = await ctx.db.get(args.billId)
    if (!bill) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.billNotFound)
    }
    assertBillDraft(bill)

    await validateCoveredParticipantsOnBill(
      ctx,
      args.billId,
      args.coveredParticipantIds,
    )

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
    const coveredPendingIds = buildCoveredPendingIds(billPending)

    const validated = validateCombinedPaymentCreate(
      { coveredParticipantIds: args.coveredParticipantIds },
      {
        payerParticipantId: session.participantId,
        hasPendingForSession,
        coveredPendingIds,
        totals,
      },
    )
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    const requestId = await ctx.db.insert('combinedPaymentRequests', {
      billId: args.billId,
      payerParticipantId: session.participantId,
      coveredParticipantIds: args.coveredParticipantIds,
      payerAmountCents: validated.payerAmountCents,
      coveredAmountsByParticipant: validated.coveredAmountsByParticipant,
      coveredAmountCents: validated.coveredAmountCents,
      totalCents: validated.totalCents,
      status: 'pending',
      guestSessionId: sessionId,
      createdAt: Date.now(),
    })

    return { requestId, totalCents: validated.totalCents }
  },
})

export const updateCovered = mutation({
  args: {
    billId: v.id('bills'),
    sessionToken: v.string(),
    requestId: v.id('combinedPaymentRequests'),
    coveredParticipantIds: v.array(v.id('participants')),
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

    const bill = await ctx.db.get(args.billId)
    if (!bill) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.billNotFound)
    }
    assertBillDraft(bill)

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

    if (args.coveredParticipantIds.length === 0) {
      await ctx.db.patch(request._id, {
        status: 'cancelled',
        resolvedAt: Date.now(),
      })
      return { requestId: request._id, cancelled: true as const }
    }

    await validateCoveredParticipantsOnBill(
      ctx,
      args.billId,
      args.coveredParticipantIds,
    )

    const totals = await loadBillTotalsForCombinedPay(ctx, args.billId)
    const billPending = await ctx.db
      .query('combinedPaymentRequests')
      .withIndex('by_billId_status', (q) =>
        q.eq('billId', args.billId).eq('status', 'pending'),
      )
      .collect()
    const coveredPendingIds = buildCoveredPendingIds(billPending, request._id)

    const validated = validateUpdateCovered(
      { coveredParticipantIds: args.coveredParticipantIds },
      {
        payerParticipantId: session.participantId,
        coveredPendingIds,
        totals,
        transferInitiatedAt: request.transferInitiatedAt,
      },
    )
    if (!validated.ok) {
      throw new ConvexError(validated.message)
    }

    await ctx.db.patch(request._id, {
      coveredParticipantIds: args.coveredParticipantIds,
      coveredAmountsByParticipant: validated.coveredAmountsByParticipant,
      coveredAmountCents: validated.coveredAmountCents,
      payerAmountCents: validated.payerAmountCents,
      totalCents: validated.totalCents,
    })

    return { requestId: request._id, totalCents: validated.totalCents }
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

    const bill = await ctx.db.get(args.billId)
    if (!bill) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.billNotFound)
    }
    assertBillDraft(bill)

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

    const bill = await ctx.db.get(args.billId)
    if (!bill) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.billNotFound)
    }
    assertBillDraft(bill)

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

    const bill = await ctx.db.get(args.billId)
    if (!bill) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.billNotFound)
    }
    assertBillDraft(bill)

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
    const bill = await requireBillOwner(ctx, args.billId)
    assertBillDraft(bill)
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
    const bill = await requireBillOwner(ctx, args.billId)
    assertBillDraft(bill)

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
    const coveredAmounts = getCoveredAmountsFromRequest(request)
    const coveredRemainingsByParticipant: Record<string, number> = {}
    for (const coveredId of Object.keys(coveredAmounts)) {
      coveredRemainingsByParticipant[coveredId] = participantRemainingCents(
        totals,
        coveredId,
      )
    }

    const validated = validateCombinedPaymentConfirm(
      {
        payerAmountCents: request.payerAmountCents,
        coveredAmountsByParticipant: coveredAmounts,
      },
      {
        payerRemainingCents: payerRemaining,
        coveredRemainingsByParticipant,
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
          ...Object.entries(coveredAmounts).map(
            ([participantId, amountCents]) => ({
              participantId: participantId as Id<'participants'>,
              amountCents,
            }),
          ),
        ]

    for (const entry of entries) {
      const owedCents = totals.byParticipant[entry.participantId].owedCents
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
