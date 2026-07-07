export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface ParticipantInput {
  id: string
  sortOrder: number
}

export interface ItemInput {
  id: string
  unitPriceCents: number
  quantity: number
}

export interface AssignmentInput {
  itemId: string
  participantId: string
}

export interface PaymentInput {
  participantId: string
  amountCents: number
}

export interface BillCalculationInput {
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
  payments: PaymentInput[]
}

export interface ParticipantTotals {
  owedCents: number
  paidCents: number
  balanceCents: number
  status: PaymentStatus
}

export interface BillTotals {
  billTotalCents: number
  byParticipant: Record<string, ParticipantTotals>
}

export function lineTotalCents(item: ItemInput): number {
  return item.unitPriceCents * item.quantity
}

export function splitLineTotal(
  totalCents: number,
  participantIds: string[],
): Array<{ id: string; cents: number }> {
  if (participantIds.length === 0) return []
  const base = Math.floor(totalCents / participantIds.length)
  const remainder = totalCents % participantIds.length
  return participantIds.map((id, index) => ({
    id,
    cents: base + (index < remainder ? 1 : 0),
  }))
}

function paymentStatus(owedCents: number, paidCents: number): PaymentStatus {
  if (paidCents <= 0) return 'unpaid'
  if (paidCents >= owedCents) return 'paid'
  return 'partial'
}

export function calculateBillTotals(input: BillCalculationInput): BillTotals {
  const owedByParticipant: Record<string, number> = {}
  for (const p of input.participants) {
    owedByParticipant[p.id] = 0
  }

  let billTotalCents = 0

  for (const item of input.items) {
    const total = lineTotalCents(item)
    billTotalCents += total

    const assignedIds = input.assignments
      .filter((a) => a.itemId === item.id)
      .map((a) => a.participantId)

    const sortedIds = [...assignedIds].sort((a, b) => {
      const orderA =
        input.participants.find((p) => p.id === a)?.sortOrder ?? 0
      const orderB =
        input.participants.find((p) => p.id === b)?.sortOrder ?? 0
      return orderA - orderB
    })

    for (const portion of splitLineTotal(total, sortedIds)) {
      owedByParticipant[portion.id] =
        (owedByParticipant[portion.id] ?? 0) + portion.cents
    }
  }

  const paidByParticipant: Record<string, number> = {}
  for (const p of input.participants) {
    paidByParticipant[p.id] = 0
  }
  for (const payment of input.payments) {
    paidByParticipant[payment.participantId] =
      (paidByParticipant[payment.participantId] ?? 0) + payment.amountCents
  }

  const byParticipant: Record<string, ParticipantTotals> = {}
  for (const p of input.participants) {
    const owedCents = owedByParticipant[p.id] ?? 0
    const paidCents = paidByParticipant[p.id] ?? 0
    const balanceCents = owedCents - paidCents
    byParticipant[p.id] = {
      owedCents,
      paidCents,
      balanceCents,
      status: paymentStatus(owedCents, paidCents),
    }
  }

  return { billTotalCents, byParticipant }
}

export interface ValidationError {
  code: 'no_participants' | 'no_items' | 'unassigned_items'
  message: string
}

export function validateBillForFinalize(input: {
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
}): ValidationError[] {
  const errors: ValidationError[] = []

  if (input.participants.length === 0) {
    errors.push({
      code: 'no_participants',
      message: 'Добавете поне един участник.',
    })
  }

  const pricedItems = input.items.filter((i) => lineTotalCents(i) > 0)
  if (pricedItems.length === 0) {
    errors.push({
      code: 'no_items',
      message: 'Добавете поне един артикул с цена.',
    })
  }

  const unassigned = pricedItems.filter(
    (item) =>
      !input.assignments.some((a) => a.itemId === item.id),
  )
  if (unassigned.length > 0) {
    errors.push({
      code: 'unassigned_items',
      message: 'Всички артикули трябва да имат поне един участник.',
    })
  }

  return errors
}
