import {
  calculateBillTotals,
  validateBillForFinalize,
  type AssignmentInput,
  type ItemInput,
  type ParticipantInput,
  type PaymentInput,
} from './bill-calculations'
import { itemHasFullUnitCoverage } from './unit-coverage'

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
  const step1 = input.restaurantName.trim().length > 0
  const billParticipants = input.hostParticipantId
    ? input.participants.filter((p) => p.id !== input.hostParticipantId)
    : input.participants
  const step2 = billParticipants.length >= 1
  const step3 =
    input.items.length >= 1 &&
    input.items.every((item) => itemHasFullUnitCoverage(item, input.assignments))

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
      (p) => totals.byParticipant[p.id]?.status === 'paid',
    )
  const step4 = finalizeReady && allPaid

  return { 1: step1, 2: step2, 3: step3, 4: step4 }
}
