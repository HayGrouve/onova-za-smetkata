import type {
  BillBreakdownInput,
  BillCalculationInput,
} from './bill-calculations'

export interface BillCalculationContext {
  tipCents?: number
  hostParticipantId?: string
}

export interface LoadedBillRelations {
  participants: Array<{ _id: string; sortOrder: number }>
  items: Array<{
    _id: string
    name: string
    unitPriceCents: number
    quantity: number
  }>
  assignments: Array<{
    itemId: string
    participantId: string
    unitIndex: number
  }>
  payments: Array<{ participantId: string; amountCents: number }>
}

export interface BillCalculationSnapshot {
  calculationInput: BillCalculationInput
  breakdownInput: BillBreakdownInput
}

export function toBillCalculationSnapshot(
  relations: LoadedBillRelations,
  context: BillCalculationContext,
): BillCalculationSnapshot {
  const participants = relations.participants.map((participant) => ({
    id: participant._id,
    sortOrder: participant.sortOrder,
  }))
  const items = relations.items.map((item) => ({
    id: item._id,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
  }))
  const breakdownItems = relations.items.map((item) => ({
    id: item._id,
    name: item.name,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
  }))
  const assignments = relations.assignments.map((assignment) => ({
    itemId: assignment.itemId,
    participantId: assignment.participantId,
    unitIndex: assignment.unitIndex,
  }))
  const payments = relations.payments.map((payment) => ({
    participantId: payment.participantId,
    amountCents: payment.amountCents,
  }))
  const tipCents = context.tipCents ?? 0

  return {
    calculationInput: {
      participants,
      items,
      assignments,
      payments,
      tipCents,
      hostParticipantId: context.hostParticipantId,
    },
    breakdownInput: {
      participants,
      items: breakdownItems,
      assignments,
      tipCents,
    },
  }
}
