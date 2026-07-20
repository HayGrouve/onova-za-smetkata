import {
  countItemsWithEmptyUnits,
  itemHasEmptyUnit,
} from './unit-coverage'

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
  unitIndex: number
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
  /** When set, collection status for this Participant is always paid. */
  hostParticipantId?: string
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

function sortParticipantIds(
  participantIds: string[],
  participants: ParticipantInput[],
): string[] {
  return [...participantIds].sort((a, b) => {
    const orderA = participants.find((p) => p.id === a)?.sortOrder ?? 0
    const orderB = participants.find((p) => p.id === b)?.sortOrder ?? 0
    return orderA - orderB
  })
}

function paymentStatus(owedCents: number, paidCents: number): PaymentStatus {
  if (paidCents <= 0) return 'unpaid'
  if (paidCents >= owedCents) return 'paid'
  return 'partial'
}

function applyAlwaysPaidHostCollection(
  totals: BillTotals,
  hostParticipantId: string | undefined,
): BillTotals {
  if (!hostParticipantId) return totals

  const host = totals.byParticipant[hostParticipantId]
  if (!host) return totals

  return {
    ...totals,
    byParticipant: {
      ...totals.byParticipant,
      [hostParticipantId]: {
        owedCents: host.owedCents,
        paidCents: host.owedCents,
        balanceCents: 0,
        status: 'paid',
      },
    },
  }
}

function addUnitShareToOwed(
  owedByParticipant: Record<string, number>,
  item: ItemInput,
  unitIndex: number,
  itemAssignments: AssignmentInput[],
  participants: ParticipantInput[],
): void {
  const onUnit = itemAssignments.filter(
    (assignment) => assignment.unitIndex === unitIndex,
  )
  if (onUnit.length === 0) return

  const sortedIds = sortParticipantIds(
    onUnit.map((assignment) => assignment.participantId),
    participants,
  )
  for (const portion of splitLineTotal(item.unitPriceCents, sortedIds)) {
    owedByParticipant[portion.id] =
      (owedByParticipant[portion.id] ?? 0) + portion.cents
  }
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

    for (let unitIndex = 0; unitIndex < item.quantity; unitIndex++) {
      addUnitShareToOwed(
        owedByParticipant,
        item,
        unitIndex,
        itemAssignments,
        input.participants,
      )
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

  return applyAlwaysPaidHostCollection(
    { billTotalCents, byParticipant },
    input.hostParticipantId,
  )
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
    const myUnitIndexes = itemAssignments
      .filter((assignment) => assignment.participantId === participantId)
      .map((assignment) => assignment.unitIndex)
    if (myUnitIndexes.length === 0) continue

    let amountCents = 0
    let sharedWithCount = 0
    let sharedWithParticipantIds: string[] = []

    for (const unitIndex of myUnitIndexes) {
      const onUnit = itemAssignments.filter(
        (assignment) => assignment.unitIndex === unitIndex,
      )
      const sortedIds = sortParticipantIds(
        onUnit.map((assignment) => assignment.participantId),
        input.participants,
      )
      const portion = splitLineTotal(item.unitPriceCents, sortedIds).find(
        (p) => p.id === participantId,
      )
      if (!portion) continue
      amountCents += portion.cents

      if (item.quantity === 1) {
        sharedWithCount = sortedIds.length - 1
        sharedWithParticipantIds = sortedIds.filter((id) => id !== participantId)
      }
    }

    itemsSubtotalCents += amountCents

    if (item.quantity === 1) {
      lines.push({
        kind: 'item',
        itemId: item.id,
        label: item.name,
        amountCents,
        sharedWithCount,
        sharedWithParticipantIds,
      })
      continue
    }

    lines.push({
      kind: 'item',
      itemId: item.id,
      label: item.name,
      amountCents,
      units: myUnitIndexes.length,
      totalUnits: item.quantity,
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
    | 'empty_units'
    | 'missing_restaurant'
    | 'unpaid_participants'
  message: string
}

export function validateBillForFinalize(input: {
  restaurantName: string
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
  payments?: PaymentInput[]
  tipCents?: number
  hostParticipantId?: string
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

  const emptyUnitItemCount = countItemsWithEmptyUnits(
    input.items,
    input.assignments,
  )
  if (emptyUnitItemCount > 0) {
    errors.push({
      code: 'empty_units',
      message:
        emptyUnitItemCount === 1
          ? 'Има 1 неразпределен артикул.'
          : `Има ${emptyUnitItemCount} неразпределени артикула.`,
    })
  }

  if (input.participants.length > 0) {
    const totals = calculateBillTotals({
      participants: input.participants,
      items: input.items,
      assignments: input.assignments,
      payments: input.payments ?? [],
      tipCents: input.tipCents,
      hostParticipantId: input.hostParticipantId,
    })
    const hasUnpaidParticipant = input.participants.some(
      (participant) => totals.byParticipant[participant.id]?.status !== 'paid',
    )
    if (hasUnpaidParticipant) {
      errors.push({
        code: 'unpaid_participants',
        message:
          'Маркирайте всички участници като платили, преди да завършите сметката.',
      })
    }
  }

  return errors
}

export { itemHasEmptyUnit, countItemsWithEmptyUnits }
