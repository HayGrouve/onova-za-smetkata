import { ConvexError } from 'convex/values'
import { validateBillForFinalize } from '../../shared/bill-calculations'
import type {
  AssignmentInput,
  ItemInput,
  ParticipantInput,
  PaymentInput,
  ValidationError,
} from '../../shared/bill-calculations'

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
