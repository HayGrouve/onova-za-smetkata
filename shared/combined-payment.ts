import type { BillTotals } from './bill-calculations'
import { COMBINED_PAYMENT_MESSAGES } from './combined-payment-messages'

export type CoveredPaymentRequest = {
  coveredParticipantIds?: string[]
  coveredParticipantId?: string
}

/** What a Pay request asks for: what the payer has left plus each covered seat's. */
export type PayRequestPrice = {
  payerAmountCents: number
  coveredAmountsByParticipant: Record<string, number>
  coveredAmountCents: number
  totalCents: number
}

export type CombinedPaymentConfirmInput = {
  payerAmountCents: number
  coveredAmountsByParticipant: Record<string, number>
}

export type CombinedPaymentConfirmContext = {
  payerRemainingCents: number
  coveredRemainingsByParticipant: Record<string, number>
}

export function getCoveredParticipantIds(
  request: CoveredPaymentRequest,
): string[] {
  if (
    request.coveredParticipantIds &&
    request.coveredParticipantIds.length > 0
  ) {
    return request.coveredParticipantIds
  }
  if (request.coveredParticipantId) {
    return [request.coveredParticipantId]
  }
  return []
}

function isCombinedPaymentRequest(request: CoveredPaymentRequest): boolean {
  return getCoveredParticipantIds(request).length > 0
}

export function isSoloPaymentRequest(request: CoveredPaymentRequest): boolean {
  return !isCombinedPaymentRequest(request)
}

export function isAwaitingHostConfirmation(request: {
  status: string
  transferInitiatedAt?: number
}): boolean {
  return request.status === 'pending' && request.transferInitiatedAt != null
}

/**
 * Whether a pay-for-others request still locks its Covered seats. A
 * reservation (transfer not started yet) only holds while the payer's guest
 * session is alive; a started transfer holds until the Host confirms or
 * rejects it.
 */
export function holdsCoveredSeats(
  request: { status: string; transferInitiatedAt?: number },
  payerSessionAlive: boolean,
): boolean {
  if (request.status !== 'pending') return false
  return isAwaitingHostConfirmation(request) || payerSessionAlive
}

export function participantRemainingCents(
  totals: BillTotals,
  participantId: string,
): number {
  if (!(participantId in totals.byParticipant)) return 0
  return Math.max(0, totals.byParticipant[participantId].balanceCents)
}

function validateCoveredParticipantIds(
  coveredParticipantIds: string[],
  payerParticipantId: string,
  coveredPendingIds: Set<string>,
  totals: BillTotals,
):
  | { ok: true; coveredAmountsByParticipant: Record<string, number> }
  | { ok: false; message: string } {
  const uniqueIds = [...new Set(coveredParticipantIds)]
  if (uniqueIds.length !== coveredParticipantIds.length) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.duplicateCovered }
  }

  if (uniqueIds.includes(payerParticipantId)) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.sameParticipant }
  }

  const coveredAmountsByParticipant: Record<string, number> = {}
  for (const coveredId of uniqueIds) {
    if (coveredPendingIds.has(coveredId)) {
      return {
        ok: false,
        message: COMBINED_PAYMENT_MESSAGES.coveredPendingExists,
      }
    }
    const coveredAmountCents = participantRemainingCents(totals, coveredId)
    if (coveredAmountCents <= 0) {
      return {
        ok: false,
        message: COMBINED_PAYMENT_MESSAGES.coveredAlreadyPaid,
      }
    }
    coveredAmountsByParticipant[coveredId] = coveredAmountCents
  }

  return { ok: true, coveredAmountsByParticipant }
}

/**
 * Price a Pay request from the bill's current totals. Paying only for oneself,
 * the payer must still owe something; covering others, the payer may owe
 * nothing (e.g. already paid) and still pay for them.
 */
export function pricePayRequest(input: {
  payerParticipantId: string
  coveredParticipantIds: string[]
  /** Seats another live Pay request already pays for. */
  coveredPendingIds: Set<string>
  totals: BillTotals
}): ({ ok: true } & PayRequestPrice) | { ok: false; message: string } {
  const payerAmountCents = participantRemainingCents(
    input.totals,
    input.payerParticipantId,
  )
  if (input.coveredParticipantIds.length === 0) {
    if (payerAmountCents <= 0) {
      return { ok: false, message: COMBINED_PAYMENT_MESSAGES.payerNothingOwed }
    }
    return {
      ok: true,
      payerAmountCents,
      coveredAmountsByParticipant: {},
      coveredAmountCents: 0,
      totalCents: payerAmountCents,
    }
  }

  const covered = validateCoveredParticipantIds(
    input.coveredParticipantIds,
    input.payerParticipantId,
    input.coveredPendingIds,
    input.totals,
  )
  if (!covered.ok) return covered

  const coveredAmountCents = Object.values(
    covered.coveredAmountsByParticipant,
  ).reduce((sum, amount) => sum + amount, 0)
  return {
    ok: true,
    payerAmountCents,
    coveredAmountsByParticipant: covered.coveredAmountsByParticipant,
    coveredAmountCents,
    totalCents: payerAmountCents + coveredAmountCents,
  }
}

export function validateCombinedPaymentConfirm(
  input: CombinedPaymentConfirmInput,
  ctx: CombinedPaymentConfirmContext,
): { ok: true } | { ok: false; message: string } {
  if (input.payerAmountCents > ctx.payerRemainingCents) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.payerOverRemaining }
  }

  for (const [participantId, amountCents] of Object.entries(
    input.coveredAmountsByParticipant,
  )) {
    const remaining = ctx.coveredRemainingsByParticipant[participantId] ?? 0
    if (amountCents > remaining) {
      return {
        ok: false,
        message: COMBINED_PAYMENT_MESSAGES.coveredAlreadyPaid,
      }
    }
  }

  return { ok: true }
}

export function getCoveredAmountsFromRequest(
  request: CoveredPaymentRequest & {
    coveredAmountCents?: number
    coveredAmountsByParticipant?: Record<string, number>
  },
): Record<string, number> {
  if (
    request.coveredAmountsByParticipant &&
    Object.keys(request.coveredAmountsByParticipant).length > 0
  ) {
    return request.coveredAmountsByParticipant
  }
  const ids = getCoveredParticipantIds(request)
  if (ids.length === 1 && request.coveredAmountCents != null) {
    return { [ids[0]]: request.coveredAmountCents }
  }
  return {}
}
