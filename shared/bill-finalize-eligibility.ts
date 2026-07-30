import {
  calculateBillTotals,
  validateBillForFinalize,
} from './bill-calculations'
import type { ValidationError } from './bill-calculations'
import { isHostParticipant } from './host-bill-participant'
import type { BillCalculationSnapshot } from './bill-calculation-snapshot'

export interface BillFinalizeEligibilityInput {
  restaurantName: string
  snapshot: BillCalculationSnapshot
  participants: Array<{ _id: string }>
  hostParticipantId?: string
}

export interface BillFinalizeEligibility {
  validationErrors: ValidationError[]
  finalizeValidationPasses: boolean
  unpaidCount: number
}

export function getBillFinalizeEligibility(
  input: BillFinalizeEligibilityInput,
): BillFinalizeEligibility {
  const validationErrors = validateBillForFinalize({
    ...input.snapshot.calculationInput,
    restaurantName: input.restaurantName,
  }).filter((error) => error.code !== 'unpaid_participants')

  const totals = calculateBillTotals(input.snapshot.calculationInput)
  const unpaidCount = input.participants.filter(
    (participant) =>
      !isHostParticipant(participant._id, input.hostParticipantId) &&
      totals.byParticipant[participant._id].status !== 'paid',
  ).length

  return {
    validationErrors,
    finalizeValidationPasses: validationErrors.length === 0,
    unpaidCount,
  }
}
