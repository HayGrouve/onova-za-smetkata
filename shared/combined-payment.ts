import type { BillTotals } from './bill-calculations'
import { COMBINED_PAYMENT_MESSAGES } from './combined-payment-messages'

export { COMBINED_PAYMENT_MESSAGES } from './combined-payment-messages'

export type CombinedPaymentCreateInput = {
  coveredParticipantId: string
}

export type CombinedPaymentCreateContext = {
  payerParticipantId: string
  hasPendingForSession: boolean
  coveredHasPending: boolean
  totals: BillTotals
}

export type CombinedPaymentCreateResult = {
  payerAmountCents: number
  coveredAmountCents: number
  totalCents: number
}

export type CombinedPaymentConfirmInput = {
  payerAmountCents: number
  coveredAmountCents: number
}

export type CombinedPaymentConfirmContext = {
  payerRemainingCents: number
  coveredRemainingCents: number
}

export type SoloPaymentCreateContext = {
  payerParticipantId: string
  hasPendingForSession: boolean
  totals: BillTotals
}

export type PaymentRequestTransferState = {
  status: string
  coveredParticipantId?: string
  transferInitiatedAt?: number
}

export function isSoloPaymentRequest(request: {
  coveredParticipantId?: string
}): boolean {
  return !request.coveredParticipantId
}

export function isAwaitingHostConfirmation(request: {
  status: string
  transferInitiatedAt?: number
}): boolean {
  return request.status === 'pending' && request.transferInitiatedAt != null
}

export function validateSoloPaymentCreate(
  ctx: SoloPaymentCreateContext,
):
  | { ok: true; payerAmountCents: number; totalCents: number }
  | { ok: false; message: string } {
  if (ctx.hasPendingForSession) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.pendingExists }
  }
  const payerAmountCents = participantRemainingCents(
    ctx.totals,
    ctx.payerParticipantId,
  )
  if (payerAmountCents <= 0) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.payerNothingOwed }
  }
  return { ok: true, payerAmountCents, totalCents: payerAmountCents }
}

export function validateInitiateTransfer(
  request: PaymentRequestTransferState,
): { ok: true } | { ok: false; message: string } {
  if (request.status !== 'pending') {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.requestNotPending }
  }
  if (isSoloPaymentRequest(request)) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.transferNotInitiated }
  }
  if (request.transferInitiatedAt != null) {
    return {
      ok: false,
      message: COMBINED_PAYMENT_MESSAGES.transferAlreadyInitiated,
    }
  }
  return { ok: true }
}

export function participantRemainingCents(
  totals: BillTotals,
  participantId: string,
): number {
  return Math.max(0, totals.byParticipant[participantId]?.balanceCents ?? 0)
}

export function validateCombinedPaymentCreate(
  input: CombinedPaymentCreateInput,
  ctx: CombinedPaymentCreateContext,
):
  | ({ ok: true } & CombinedPaymentCreateResult)
  | { ok: false; message: string } {
  if (input.coveredParticipantId === ctx.payerParticipantId) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.sameParticipant }
  }
  if (ctx.hasPendingForSession) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.pendingExists }
  }
  if (ctx.coveredHasPending) {
    return {
      ok: false,
      message: COMBINED_PAYMENT_MESSAGES.coveredPendingExists,
    }
  }

  const payerAmountCents = participantRemainingCents(
    ctx.totals,
    ctx.payerParticipantId,
  )
  const coveredAmountCents = participantRemainingCents(
    ctx.totals,
    input.coveredParticipantId,
  )

  if (payerAmountCents <= 0) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.payerNothingOwed }
  }
  if (coveredAmountCents <= 0) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.coveredAlreadyPaid }
  }

  return {
    ok: true,
    payerAmountCents,
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
  if (input.coveredAmountCents > ctx.coveredRemainingCents) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.coveredAlreadyPaid }
  }
  return { ok: true }
}
