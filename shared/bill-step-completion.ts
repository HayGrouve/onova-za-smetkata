import {
  validateBillForFinalize,
  type AssignmentInput,
  type ItemInput,
  type ParticipantInput,
} from './bill-calculations.ts'

export type BillStepNumber = 1 | 2 | 3 | 4

export type BillStepCompletion = Record<BillStepNumber, boolean>

export interface BillStepCompletionInput {
  restaurantName: string
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
}

export function getBillStepCompletion(
  input: BillStepCompletionInput,
): BillStepCompletion {
  const step1 = input.restaurantName.trim().length > 0
  const step2 = input.participants.length >= 1
  const step3 =
    input.items.length >= 1 &&
    input.items.every((item) =>
      input.assignments.some((a) => a.itemId === item.id),
    )
  const step4 = validateBillForFinalize(input).length === 0
  return { 1: step1, 2: step2, 3: step3, 4: step4 }
}
