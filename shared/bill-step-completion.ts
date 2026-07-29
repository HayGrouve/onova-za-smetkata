import {
  calculateBillTotals,
  validateBillForFinalize,
} from './bill-calculations'
import type {
  AssignmentInput,
  ItemInput,
  ParticipantInput,
  PaymentInput,
} from './bill-calculations'
import {
  isAllocationReady,
  isBillDetailsStepReady,
  isParticipantsStepReady,
} from './bill-readiness'

export type BillStepNumber = 1 | 2 | 3 | 4

export type BillStepCompletion = Record<BillStepNumber, boolean>

export interface BillStepCompletionInput {
  restaurantName: string
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
  payments?: PaymentInput[]
  tipCents?: number
  hostParticipantId?: string
}

export function getBillStepCompletion(
  input: BillStepCompletionInput,
): BillStepCompletion {
  const step1 = isBillDetailsStepReady(input.restaurantName)
  const step2 = isParticipantsStepReady({
    participants: input.participants,
    hostParticipantId: input.hostParticipantId,
  })
  const step3 = isAllocationReady({
    items: input.items,
    assignments: input.assignments,
  })

  const finalizeReady = validateBillForFinalize(input).length === 0
  const totals = calculateBillTotals({
    participants: input.participants,
    items: input.items,
    assignments: input.assignments,
    payments: input.payments ?? [],
    tipCents: input.tipCents,
    hostParticipantId: input.hostParticipantId,
  })
  const allPaid =
    input.participants.length > 0 &&
    input.participants.every(
      (p) => totals.byParticipant[p.id].status === 'paid',
    )
  const step4 = finalizeReady && allPaid

  return { 1: step1, 2: step2, 3: step3, 4: step4 }
}
