import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireBillOwner } from './lib/auth'
import { findGuest, requireGuest } from './lib/guestSession'
import {
  cancelPayRequest,
  confirmPayRequest,
  payRequestCovering,
  pendingPayRequestOf,
  rejectPayRequest,
  reservePayRequest,
  sendPayRequest,
  sentPayRequestsForBill,
} from './lib/payRequest'
import { getCoveredAmountsFromRequest } from '../shared/combined-payment'

const priced = v.object({
  requestId: v.id('combinedPaymentRequests'),
  totalCents: v.number(),
})

export const getPendingForGuest = query({
  args: {
    billId: v.id('bills'),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const guest = await findGuest(ctx, args)
    if (!guest) return null
    return await pendingPayRequestOf(ctx, guest.session)
  },
})

export const listPendingForBill = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    await requireBillOwner(ctx, args.billId)
    return await sentPayRequestsForBill(ctx, args.billId)
  },
})

export const getPendingCoverForGuest = query({
  args: {
    billId: v.id('bills'),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const guest = await findGuest(ctx, args)
    if (!guest) return null
    const { participantId } = guest.session
    const cover = await payRequestCovering(ctx, args.billId, participantId)
    if (!cover) return null

    const payer = await ctx.db.get(cover.payerParticipantId)
    const coveredAmounts = getCoveredAmountsFromRequest(cover)
    return {
      requestId: cover._id,
      payerParticipantId: cover.payerParticipantId,
      payerName: payer?.name ?? 'Участник',
      coveredAmountCents:
        coveredAmounts[participantId] ?? cover.coveredAmountCents,
      totalCents: cover.totalCents,
    }
  },
})

/** Pick the other Guests this phone pays for; nobody drops the Reservation. */
export const reserve = mutation({
  args: {
    billId: v.id('bills'),
    sessionToken: v.string(),
    otherParticipantIds: v.array(v.id('participants')),
  },
  returns: v.union(priced, v.null()),
  handler: async (ctx, args) => {
    const guest = await requireGuest(ctx, args)
    const request = await reservePayRequest(
      ctx,
      guest,
      args.otherParticipantIds,
    )
    return request
      ? { requestId: request._id, totalCents: request.totalCents }
      : null
  },
})

/** Revolut opened or the IBAN was copied: price the request and mark it Sent. */
export const recordTransfer = mutation({
  args: {
    billId: v.id('bills'),
    sessionToken: v.string(),
    otherParticipantIds: v.array(v.id('participants')),
  },
  returns: priced,
  handler: async (ctx, args) => {
    const guest = await requireGuest(ctx, args)
    const request = await sendPayRequest(ctx, guest, args.otherParticipantIds)
    return { requestId: request._id, totalCents: request.totalCents }
  },
})

export const cancel = mutation({
  args: {
    billId: v.id('bills'),
    sessionToken: v.string(),
    requestId: v.id('combinedPaymentRequests'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const guest = await requireGuest(ctx, args)
    await cancelPayRequest(ctx, guest, args.requestId)
  },
})

export const reject = mutation({
  args: {
    billId: v.id('bills'),
    requestId: v.id('combinedPaymentRequests'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    await rejectPayRequest(ctx, bill, args.requestId)
  },
})

export const confirm = mutation({
  args: {
    billId: v.id('bills'),
    requestId: v.id('combinedPaymentRequests'),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const bill = await requireBillOwner(ctx, args.billId)
    await confirmPayRequest(ctx, bill, args.requestId)
  },
})
