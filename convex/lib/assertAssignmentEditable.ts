import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'

export type AssignmentEditableError = 'bill_final' | 'participant_not_on_bill'

export function getAssignmentEditableError(input: {
  billStatus: 'draft' | 'final'
  itemBillId: Id<'bills'>
  participantBillId: Id<'bills'> | null | undefined
}): AssignmentEditableError | null {
  if (input.billStatus === 'final') return 'bill_final'
  if (
    !input.participantBillId ||
    input.participantBillId !== input.itemBillId
  ) {
    return 'participant_not_on_bill'
  }
  return null
}

const errorMessages: Record<AssignmentEditableError, string> = {
  bill_final: 'Сметката е приключена и не може да се редактира.',
  participant_not_on_bill: 'Участникът не принадлежи на тази сметка.',
}

export function assertAssignmentEditable(input: {
  billStatus: 'draft' | 'final'
  itemBillId: Id<'bills'>
  participantBillId: Id<'bills'> | null | undefined
}): void {
  const error = getAssignmentEditableError(input)
  if (error) throw new ConvexError(errorMessages[error])
}
