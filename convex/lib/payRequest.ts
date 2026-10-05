/**
 * The Pay request lifecycle. A Guest phone asks to pay its own Share — plus
 * its Covered seats and any other Guests it picks — and the Host settles it:
 *
 *   Reservation  pending, nothing sent yet; holds the other seats while the
 *                phone stays on the bill
 *   Sent         pending with a transfer recorded („Чака“) until the Host
 *                confirms (payments recorded) or rejects it
 *
 * Any pending request may also be cancelled. A phone has at most one pending
 * request. Other modules report what happens to sessions, seats and bills
 * through the `on…` events instead of editing requests themselves.
 */
import { ConvexError } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { calculateBillTotals } from '../../shared/bill-calculations'
import type { BillTotals } from '../../shared/bill-calculations'
import { toBillCalculationSnapshot } from '../../shared/bill-calculation-snapshot'
import {
  getCoveredAmountsFromRequest,
  getCoveredParticipantIds,
  holdsCoveredSeats,
  isAwaitingHostConfirmation,
  isSoloPaymentRequest,
  participantRemainingCents,
  pricePayRequest,
  validateCombinedPaymentConfirm,
} from '../../shared/combined-payment'
import { COMBINED_PAYMENT_MESSAGES } from '../../shared/combined-payment-messages'
import { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages'
import { validatePaymentAdd } from '../../shared/payment-amount-schema'
import { assertBillDraft } from './assertBillDraft'
import { loadBillRelations } from './billListSummary'
import { isGuestSessionActive } from './guestSession'
import type { GuestActor } from './guestSession'
import { assertRateLimit } from './rateLimit'
import { touchBill } from './touchBill'

type PayRequest = Doc<'combinedPaymentRequests'>

async function pendingForBill(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
): Promise<PayRequest[]> {
  return await ctx.db
    .query('combinedPaymentRequests')
    .withIndex('by_billId_status', (q) =>
      q.eq('billId', billId).eq('status', 'pending'),
    )
    .collect()
}

async function resolve(
  ctx: MutationCtx,
  request: PayRequest,
  status: 'confirmed' | 'rejected' | 'cancelled',
): Promise<void> {
  await ctx.db.patch(request._id, { status, resolvedAt: Date.now() })
}

async function loadBillTotals(
  ctx: QueryCtx | MutationCtx,
  bill: Doc<'bills'>,
): Promise<BillTotals> {
  const relations = await loadBillRelations(ctx, bill._id)
  const { calculationInput } = toBillCalculationSnapshot(relations, {
    tipCents: bill.tipCents ?? 0,
    hostParticipantId: bill.hostParticipantId,
  })
  return calculateBillTotals(calculationInput)
}

/**
 * Pending requests that still hold their seats: every Sent one, and
 * Reservations whose phone is still on the bill. A phone that left (released
 * or expired) no longer keeps the covered Guest from paying.
 */
async function loadSeatHoldingRequests(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
): Promise<PayRequest[]> {
  const now = Date.now()
  const holding: PayRequest[] = []
  for (const request of await pendingForBill(ctx, billId)) {
    const session = await ctx.db.get(request.guestSessionId)
    const alive =
      session !== null && isGuestSessionActive(session.lastSeenAt, now)
    if (holdsCoveredSeats(request, alive)) holding.push(request)
  }
  return holding
}

// ── Reads ────────────────────────────────────────────────────────────────

/** This phone's pending request — a Reservation or Sent — if it has one. */
export async function pendingPayRequestOf(
  ctx: QueryCtx | MutationCtx,
  session: Doc<'guestSessions'>,
): Promise<PayRequest | null> {
  const requests = await ctx.db
    .query('combinedPaymentRequests')
    .withIndex('by_guestSessionId', (q) => q.eq('guestSessionId', session._id))
    .collect()
  return (
    requests.find(
      (request) =>
        request.billId === session.billId && request.status === 'pending',
    ) ?? null
  )
}

/** Sent requests the Host still has to confirm or reject. */
export async function sentPayRequestsForBill(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
): Promise<PayRequest[]> {
  return (await pendingForBill(ctx, billId)).filter(isAwaitingHostConfirmation)
}

/** The live request another phone holds that pays for `participantId`. */
export async function payRequestCovering(
  ctx: QueryCtx | MutationCtx,
  billId: Id<'bills'>,
  participantId: Id<'participants'>,
): Promise<PayRequest | null> {
  const holding = await loadSeatHoldingRequests(ctx, billId)
  return (
    holding.find((request) =>
      getCoveredParticipantIds(request).includes(participantId),
    ) ?? null
  )
}

/** This phone has sent a transfer the Host has not confirmed or rejected yet. */
export async function hasSentPayRequest(
  ctx: QueryCtx | MutationCtx,
  session: Doc<'guestSessions'>,
): Promise<boolean> {
  const pending = await pendingPayRequestOf(ctx, session)
  return pending !== null && isAwaitingHostConfirmation(pending)
}

// ── Guest intents ────────────────────────────────────────────────────────

/** Pay requests are rows: one phone must not grow them without bound. */
async function startGuestIntent(ctx: MutationCtx, guest: GuestActor) {
  await assertRateLimit(
    ctx,
    `payRequest:${guest.session.sessionToken}`,
    30,
    60_000,
  )
  assertBillDraft(guest.bill)
  return await pendingPayRequestOf(ctx, guest.session)
}

/**
 * Who this phone pays for, priced now: its own seat, its Covered seats that
 * still owe something, and the other Guests it picked. `paidOthers` decides
 * whether a picked Guest with nothing left is refused or quietly left out.
 */
async function priceForPhone(
  ctx: MutationCtx,
  guest: GuestActor,
  existing: PayRequest | null,
  otherSeatIds: Id<'participants'>[],
  paidOthers: 'refuse' | 'skip',
) {
  const { bill, session } = guest
  for (const seatId of otherSeatIds) {
    const seat = await ctx.db.get(seatId)
    if (!seat || seat.billId !== bill._id) {
      throw new ConvexError(GUEST_FLOW_MESSAGES.participantNotOnBill)
    }
  }

  const totals = await loadBillTotals(ctx, bill)
  const holding = await loadSeatHoldingRequests(ctx, bill._id)
  // One payer per Share: a Guest another phone pays for cannot pay again.
  const coveredElsewhere = holding.some(
    (request) =>
      request.guestSessionId !== session._id &&
      getCoveredParticipantIds(request).includes(session.participantId),
  )
  if (coveredElsewhere) {
    throw new ConvexError(COMBINED_PAYMENT_MESSAGES.payerCoveredByOther)
  }

  const owes = (id: Id<'participants'>) =>
    participantRemainingCents(totals, id) > 0
  const coveredSeats = guest.seatIds.filter(
    (id) => id !== session.participantId && owes(id),
  )
  const others =
    paidOthers === 'skip' ? otherSeatIds.filter(owes) : otherSeatIds
  const coveredParticipantIds = [...new Set([...coveredSeats, ...others])]

  const paidElsewhere = new Set<string>()
  for (const request of holding) {
    if (request._id === existing?._id) continue
    paidElsewhere.add(request.payerParticipantId)
    for (const id of getCoveredParticipantIds(request)) paidElsewhere.add(id)
  }
  const priced = pricePayRequest({
    payerParticipantId: session.participantId,
    coveredParticipantIds,
    coveredPendingIds: paidElsewhere,
    totals,
  })
  if (!priced.ok) throw new ConvexError(priced.message)
  return { ...priced, coveredParticipantIds }
}

async function writePending(
  ctx: MutationCtx,
  guest: GuestActor,
  existing: PayRequest | null,
  priced: Awaited<ReturnType<typeof priceForPhone>>,
  sent: boolean,
): Promise<PayRequest> {
  const solo = priced.coveredParticipantIds.length === 0
  const fields = {
    coveredParticipantIds: solo ? undefined : priced.coveredParticipantIds,
    coveredAmountsByParticipant: solo
      ? undefined
      : priced.coveredAmountsByParticipant,
    coveredAmountCents: priced.coveredAmountCents,
    payerAmountCents: priced.payerAmountCents,
    totalCents: priced.totalCents,
    ...(sent ? { transferInitiatedAt: Date.now() } : {}),
  }
  const requestId = existing
    ? existing._id
    : await ctx.db.insert('combinedPaymentRequests', {
        ...fields,
        billId: guest.bill._id,
        payerParticipantId: guest.session.participantId,
        status: 'pending',
        guestSessionId: guest.session._id,
        createdAt: Date.now(),
      })
  if (existing) await ctx.db.patch(requestId, fields)
  const request = await ctx.db.get(requestId)
  if (!request) throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotFound)
  return request
}

/**
 * Pick the other Guests this phone pays for, before sending anything. The
 * Reservation holds their seats so their phones show who is paying; picking
 * nobody drops it. Locked once the transfer is Sent.
 */
export async function reservePayRequest(
  ctx: MutationCtx,
  guest: GuestActor,
  otherSeatIds: Id<'participants'>[],
): Promise<PayRequest | null> {
  const existing = await startGuestIntent(ctx, guest)
  if (existing && isAwaitingHostConfirmation(existing)) {
    throw new ConvexError(
      COMBINED_PAYMENT_MESSAGES.selectionLockedAfterTransfer,
    )
  }
  if (otherSeatIds.length === 0) {
    if (existing) await resolve(ctx, existing, 'cancelled')
    return null
  }
  const priced = await priceForPhone(
    ctx,
    guest,
    existing,
    otherSeatIds,
    'refuse',
  )
  return await writePending(ctx, guest, existing, priced, false)
}

/**
 * The phone opened Revolut or copied the IBAN: price the request afresh and
 * mark it Sent, in one step. Guests who paid in the meantime drop out; a
 * request that is already Sent stays as it is.
 */
export async function sendPayRequest(
  ctx: MutationCtx,
  guest: GuestActor,
  otherSeatIds: Id<'participants'>[],
): Promise<PayRequest> {
  const existing = await startGuestIntent(ctx, guest)
  if (existing && isAwaitingHostConfirmation(existing)) return existing
  const priced = await priceForPhone(ctx, guest, existing, otherSeatIds, 'skip')
  return await writePending(ctx, guest, existing, priced, true)
}

/** The phone withdraws its pending request, Sent or not („Отмени“). */
export async function cancelPayRequest(
  ctx: MutationCtx,
  guest: GuestActor,
  requestId: Id<'combinedPaymentRequests'>,
): Promise<void> {
  await startGuestIntent(ctx, guest)
  const request = await ctx.db.get(requestId)
  if (
    !request ||
    request.billId !== guest.bill._id ||
    request.guestSessionId !== guest.session._id
  ) {
    throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotFound)
  }
  if (request.status !== 'pending') {
    throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotPending)
  }
  await resolve(ctx, request, 'cancelled')
}

// ── Host intents ─────────────────────────────────────────────────────────

async function requirePendingOnBill(
  ctx: MutationCtx,
  bill: Doc<'bills'>,
  requestId: Id<'combinedPaymentRequests'>,
): Promise<PayRequest> {
  assertBillDraft(bill)
  const request = await ctx.db.get(requestId)
  if (!request || request.billId !== bill._id) {
    throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotFound)
  }
  if (request.status !== 'pending') {
    throw new ConvexError(COMBINED_PAYMENT_MESSAGES.requestNotPending)
  }
  return request
}

/** „Не виждам превода“: the Host did not receive it; nothing is recorded. */
export async function rejectPayRequest(
  ctx: MutationCtx,
  bill: Doc<'bills'>,
  requestId: Id<'combinedPaymentRequests'>,
): Promise<void> {
  const request = await requirePendingOnBill(ctx, bill, requestId)
  await resolve(ctx, request, 'rejected')
}

/**
 * The Host received the transfer: record a payment for the payer and each
 * covered seat. All or nothing — if any Share shrank since the transfer was
 * sent, the Host records what arrived by hand instead.
 */
export async function confirmPayRequest(
  ctx: MutationCtx,
  bill: Doc<'bills'>,
  requestId: Id<'combinedPaymentRequests'>,
): Promise<void> {
  const request = await requirePendingOnBill(ctx, bill, requestId)
  if (request.transferInitiatedAt == null) {
    throw new ConvexError(COMBINED_PAYMENT_MESSAGES.transferNotInitiated)
  }

  const totals = await loadBillTotals(ctx, bill)
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
      payerRemainingCents: participantRemainingCents(
        totals,
        request.payerParticipantId,
      ),
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
    .withIndex('by_billId', (q) => q.eq('billId', bill._id))
    .collect()
  const entries = [
    {
      participantId: request.payerParticipantId,
      amountCents: request.payerAmountCents,
    },
    ...(isSoloPaymentRequest(request)
      ? []
      : Object.entries(coveredAmounts).map(([participantId, amountCents]) => ({
          participantId: participantId as Id<'participants'>,
          amountCents,
        }))),
  ]
  for (const entry of entries) {
    // A payer who already paid their own Share may still cover others.
    if (entry.amountCents <= 0) continue
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
      billId: bill._id,
      participantId: entry.participantId,
      amountCents: paymentValidated.data.amountCents,
      note: paymentValidated.data.note,
      paidAt: now,
    })
  }

  await resolve(ctx, request, 'confirmed')
  await touchBill(ctx, bill._id)
}

// ── Events from sessions, seats and bills ────────────────────────────────

/** A phone left the bill: its Reservation goes, a Sent transfer stays for the Host. */
export async function onGuestSessionEnded(
  ctx: MutationCtx,
  sessionId: Id<'guestSessions'>,
): Promise<void> {
  const requests = await ctx.db
    .query('combinedPaymentRequests')
    .withIndex('by_guestSessionId', (q) => q.eq('guestSessionId', sessionId))
    .collect()
  for (const request of requests) {
    if (request.status === 'pending' && !isAwaitingHostConfirmation(request)) {
      await resolve(ctx, request, 'cancelled')
    }
  }
}

/**
 * The phone is changing its Covered seats: the Pay step prices a new request
 * for the new seats, and once a transfer is Sent the seats are locked.
 */
export async function onCoveredSeatsChanging(
  ctx: MutationCtx,
  session: Doc<'guestSessions'>,
): Promise<void> {
  const pending = await pendingPayRequestOf(ctx, session)
  if (!pending) return
  if (isAwaitingHostConfirmation(pending)) {
    throw new ConvexError(GUEST_FLOW_MESSAGES.coveredSeatsLocked)
  }
  await resolve(ctx, pending, 'cancelled')
}

/**
 * A phone took a seat: it inherits the seat's pending requests whose phone is
 * gone. A phone that sat in the Revolut app past the session TTL comes back
 * with a new session, and its Sent transfer must still read „Чака“ there
 * instead of inviting a second payment.
 */
export async function onSeatClaimed(
  ctx: MutationCtx,
  args: {
    billId: Id<'bills'>
    participantId: Id<'participants'>
    sessionId: Id<'guestSessions'>
  },
): Promise<void> {
  for (const request of await pendingForBill(ctx, args.billId)) {
    if (request.payerParticipantId !== args.participantId) continue
    if (request.guestSessionId === args.sessionId) continue
    if ((await ctx.db.get(request.guestSessionId)) !== null) continue
    await ctx.db.patch(request._id, { guestSessionId: args.sessionId })
  }
}

/**
 * A seat is leaving the bill: cancel the unsent requests that pay for or cover
 * it. A Sent transfer is real money — the Host confirms or rejects it first,
 * or nobody could record it once the seat is gone.
 */
export async function onSeatRemoved(
  ctx: MutationCtx,
  billId: Id<'bills'>,
  participantId: Id<'participants'>,
): Promise<void> {
  const involving = (await pendingForBill(ctx, billId)).filter(
    (request) =>
      request.payerParticipantId === participantId ||
      getCoveredParticipantIds(request).includes(participantId),
  )
  if (involving.some(isAwaitingHostConfirmation)) {
    throw new ConvexError(COMBINED_PAYMENT_MESSAGES.participantHasTransfer)
  }
  for (const request of involving) {
    await resolve(ctx, request, 'cancelled')
  }
}

/**
 * The bill is about to lock. A Sent transfer must be confirmed or rejected by
 * the Host first — after finalize nobody could; Reservations are dropped.
 */
export async function onBillFinalizing(
  ctx: MutationCtx,
  billId: Id<'bills'>,
): Promise<void> {
  const pending = await pendingForBill(ctx, billId)
  if (pending.some(isAwaitingHostConfirmation)) {
    throw new ConvexError(COMBINED_PAYMENT_MESSAGES.transfersAwaitingHost)
  }
  for (const request of pending) {
    await resolve(ctx, request, 'cancelled')
  }
}

/** The bill is being deleted: its requests go with it. */
export async function onBillDeleted(
  ctx: MutationCtx,
  billId: Id<'bills'>,
): Promise<void> {
  const requests = await ctx.db
    .query('combinedPaymentRequests')
    .withIndex('by_billId_status', (q) => q.eq('billId', billId))
    .collect()
  for (const request of requests) {
    await ctx.db.delete(request._id)
  }
}
