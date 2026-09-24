import { ConvexError } from 'convex/values'
import { GUEST_FLOW_MESSAGES } from '../../shared/guest-flow-messages'

export function assertBillDraft(bill: { status: 'draft' | 'final' }): void {
  if (bill.status === 'final') {
    throw new ConvexError(GUEST_FLOW_MESSAGES.billFinalNoEdit)
  }
}
