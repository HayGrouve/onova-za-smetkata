import type { BillTotals } from './bill-calculations'
import { COMBINED_PAYMENT_MESSAGES } from './combined-payment-messages'

export { COMBINED_PAYMENT_MESSAGES } from './combined-payment-messages'

export type CoveredPaymentRequest = {
  coveredParticipantIds?: string[]
  coveredParticipantId?: string
}

export type CombinedPaymentCreateInput = {
  coveredParticipantIds: string[]
}

export type CombinedPaymentCreateContext = {
  payerParticipantId: string
  hasPendingForSession: boolean
  coveredPendingIds: Set<string>
  totals: BillTotals
}

export type CombinedPaymentCreateResult = {
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

export type CombinedPaymentUpdateContext = Omit<
  CombinedPaymentCreateContext,
  'hasPendingForSession'
> & {
  transferInitiatedAt?: number
}

export type SoloPaymentCreateContext = {
  payerParticipantId: string
  hasPendingForSession: boolean
  totals: BillTotals
}

export type PaymentRequestTransferState = CoveredPaymentRequest & {
  status: string
  transferInitiatedAt?: number
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

export function isCombinedPaymentRequest(
  request: CoveredPaymentRequest,
): boolean {
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
    return {
      ok: false,
      message: COMBINED_PAYMENT_MESSAGES.transferNotInitiated,
    }
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
  if (coveredParticipantIds.length === 0) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.noCoveredSelected }
  }

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

export function validateCombinedPaymentCreate(
  input: CombinedPaymentCreateInput,
  ctx: CombinedPaymentCreateContext,
):
  | ({ ok: true } & CombinedPaymentCreateResult)
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

  const coveredValidated = validateCoveredParticipantIds(
    input.coveredParticipantIds,
    ctx.payerParticipantId,
    ctx.coveredPendingIds,
    ctx.totals,
  )
  if (!coveredValidated.ok) {
    return coveredValidated
  }

  const coveredAmountCents = Object.values(
    coveredValidated.coveredAmountsByParticipant,
  ).reduce((sum, amount) => sum + amount, 0)

  return {
    ok: true,
    payerAmountCents,
    coveredAmountsByParticipant: coveredValidated.coveredAmountsByParticipant,
    coveredAmountCents,
    totalCents: payerAmountCents + coveredAmountCents,
  }
}

export function validateUpdateCovered(
  input: CombinedPaymentCreateInput,
  ctx: CombinedPaymentUpdateContext,
):
  | ({ ok: true } & CombinedPaymentCreateResult)
  | { ok: false; message: string } {
  if (ctx.transferInitiatedAt != null) {
    return {
      ok: false,
      message: COMBINED_PAYMENT_MESSAGES.selectionLockedAfterTransfer,
    }
  }

  const payerAmountCents = participantRemainingCents(
    ctx.totals,
    ctx.payerParticipantId,
  )
  if (payerAmountCents <= 0) {
    return { ok: false, message: COMBINED_PAYMENT_MESSAGES.payerNothingOwed }
  }

  const coveredValidated = validateCoveredParticipantIds(
    input.coveredParticipantIds,
    ctx.payerParticipantId,
    ctx.coveredPendingIds,
    ctx.totals,
  )
  if (!coveredValidated.ok) {
    return coveredValidated
  }

  const coveredAmountCents = Object.values(
    coveredValidated.coveredAmountsByParticipant,
  ).reduce((sum, amount) => sum + amount, 0)

  return {
    ok: true,
    payerAmountCents,
    coveredAmountsByParticipant: coveredValidated.coveredAmountsByParticipant,
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
