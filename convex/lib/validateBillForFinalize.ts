import { ConvexError } from 'convex/values'
import {
  validateBillForFinalize,
  type AssignmentInput,
  type ItemInput,
  type ParticipantInput,
  type PaymentInput,
  type ValidationError,
} from './billCalculations'

export type FinalizeParticipantInput = ParticipantInput
export type FinalizeItemInput = ItemInput
export type FinalizeAssignmentInput = AssignmentInput
export type FinalizeValidationError = ValidationError

export { validateBillForFinalize }

export function assertBillCanFinalize(input: {
  restaurantName: string
  participants: FinalizeParticipantInput[]
  items: FinalizeItemInput[]
  assignments: FinalizeAssignmentInput[]
  payments?: PaymentInput[]
  tipCents?: number
  hostParticipantId?: string
}): void {
  const errors = validateBillForFinalize(input)
  if (errors.length > 0) {
    throw new ConvexError(errors[0].message)
  }
}
