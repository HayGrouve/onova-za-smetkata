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
  units?: number
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
  tipCents?: number
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

export function splitUnits(quantity: number, count: number): number[] {
  if (count <= 0) return []
  const base = Math.floor(quantity / count)
  const remainder = quantity % count
  return Array.from(
    { length: count },
    (_, index) => base + (index < remainder ? 1 : 0),
  )
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

    const itemAssignments = input.assignments.filter(
      (a) => a.itemId === item.id,
    )
    const usesUnits = itemAssignments.some((a) => a.units !== undefined)

    if (usesUnits) {
      for (const assignment of itemAssignments) {
        const units = assignment.units ?? 0
        owedByParticipant[assignment.participantId] =
          (owedByParticipant[assignment.participantId] ?? 0) +
          units * item.unitPriceCents
      }
      continue
    }

    const assignedIds = itemAssignments.map((a) => a.participantId)

    const sortedIds = [...assignedIds].sort((a, b) => {
      const orderA = input.participants.find((p) => p.id === a)?.sortOrder ?? 0
      const orderB = input.participants.find((p) => p.id === b)?.sortOrder ?? 0
      return orderA - orderB
    })

    for (const portion of splitLineTotal(total, sortedIds)) {
      owedByParticipant[portion.id] =
        (owedByParticipant[portion.id] ?? 0) + portion.cents
    }
  }

  const tipCents = input.tipCents ?? 0
  if (tipCents > 0) {
    billTotalCents += tipCents
    const sortedParticipantIds = [...input.participants]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => p.id)
    for (const portion of splitLineTotal(tipCents, sortedParticipantIds)) {
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

export function totalOutstandingCents(totals: BillTotals): number {
  return Object.values(totals.byParticipant).reduce(
    (sum, participant) => sum + Math.max(0, participant.balanceCents),
    0,
  )
}

export interface ItemBreakdownInput extends ItemInput {
  name: string
}

export interface BillBreakdownInput {
  participants: ParticipantInput[]
  items: ItemBreakdownInput[]
  assignments: AssignmentInput[]
  tipCents?: number
}

export type ParticipantBreakdownLine =
  | {
      kind: 'item'
      itemId: string
      label: string
      amountCents: number
      sharedWithCount?: number
      sharedWithParticipantIds?: string[]
      units?: number
      totalUnits?: number
    }
  | {
      kind: 'tip'
      amountCents: number
    }

export interface ParticipantBreakdown {
  itemsSubtotalCents: number
  tipCents: number
  owedCents: number
  lines: ParticipantBreakdownLine[]
}

export function calculateParticipantBreakdown(
  input: BillBreakdownInput,
  participantId: string,
): ParticipantBreakdown {
  const lines: ParticipantBreakdownLine[] = []
  let itemsSubtotalCents = 0

  for (const item of input.items) {
    const itemAssignments = input.assignments.filter(
      (a) => a.itemId === item.id,
    )
    const usesUnits = itemAssignments.some((a) => a.units !== undefined)

    if (usesUnits) {
      const assignment = itemAssignments.find(
        (a) => a.participantId === participantId,
      )
      if (!assignment) continue
      const units = assignment.units ?? 0
      const amountCents = units * item.unitPriceCents
      itemsSubtotalCents += amountCents
      lines.push({
        kind: 'item',
        itemId: item.id,
        label: item.name,
        amountCents,
        units,
        totalUnits: item.quantity,
      })
      continue
    }

    const assignedIds = itemAssignments.map((a) => a.participantId)
    if (!assignedIds.includes(participantId)) continue

    const sortedIds = [...assignedIds].sort((a, b) => {
      const orderA = input.participants.find((p) => p.id === a)?.sortOrder ?? 0
      const orderB = input.participants.find((p) => p.id === b)?.sortOrder ?? 0
      return orderA - orderB
    })

    const total = lineTotalCents(item)
    const portion = splitLineTotal(total, sortedIds).find(
      (p) => p.id === participantId,
    )
    if (!portion) continue

    itemsSubtotalCents += portion.cents
    lines.push({
      kind: 'item',
      itemId: item.id,
      label: item.name,
      amountCents: portion.cents,
      sharedWithCount: sortedIds.length - 1,
      sharedWithParticipantIds: sortedIds.filter((id) => id !== participantId),
    })
  }

  let tipCents = 0
  const tipTotal = input.tipCents ?? 0
  if (tipTotal > 0) {
    const sortedParticipantIds = [...input.participants]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => p.id)
    const tipPortion = splitLineTotal(tipTotal, sortedParticipantIds).find(
      (p) => p.id === participantId,
    )
    if (tipPortion) {
      tipCents = tipPortion.cents
      lines.push({ kind: 'tip', amountCents: tipCents })
    }
  }

  const owedCents = itemsSubtotalCents + tipCents

  return {
    itemsSubtotalCents,
    tipCents,
    owedCents,
    lines,
  }
}

export interface ValidationError {
  code:
    | 'no_participants'
    | 'no_items'
    | 'unassigned_items'
    | 'units_mismatch'
    | 'missing_restaurant'
  message: string
}

export function validateBillForFinalize(input: {
  restaurantName: string
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
}): ValidationError[] {
  const errors: ValidationError[] = []

  if (!input.restaurantName.trim()) {
    errors.push({
      code: 'missing_restaurant',
      message: 'Въведете име на ресторант.',
    })
  }

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

  const unassigned = input.items.filter(
    (item) => !input.assignments.some((a) => a.itemId === item.id),
  )
  if (unassigned.length > 0) {
    errors.push({
      code: 'unassigned_items',
      message:
        unassigned.length === 1
          ? 'Има 1 неразпределен артикул.'
          : `Има ${unassigned.length} неразпределени артикула.`,
    })
  }

  for (const item of pricedItems) {
    const itemAssignments = input.assignments.filter(
      (a) => a.itemId === item.id,
    )
    if (itemAssignments.length === 0) continue
    const usesUnits = itemAssignments.some((a) => a.units !== undefined)
    if (!usesUnits) continue
    const assignedUnits = itemAssignments.reduce(
      (sum, assignment) => sum + (assignment.units ?? 0),
      0,
    )
    if (assignedUnits !== item.quantity) {
      errors.push({
        code: 'units_mismatch',
        message:
          'Разпределеният брой не съвпада с количеството на някой артикул.',
      })
      break
    }
  }

  return errors
}
