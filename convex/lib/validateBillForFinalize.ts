export interface FinalizeParticipantInput {
  id: string
  sortOrder: number
}

export interface FinalizeItemInput {
  id: string
  unitPriceCents: number
  quantity: number
}

export interface FinalizeAssignmentInput {
  itemId: string
  participantId: string
  units?: number
}

export interface FinalizeValidationError {
  code:
    | 'no_participants'
    | 'no_items'
    | 'unassigned_items'
    | 'units_mismatch'
    | 'missing_restaurant'
  message: string
}

function lineTotalCents(item: FinalizeItemInput): number {
  return item.unitPriceCents * item.quantity
}

export function validateBillForFinalize(input: {
  restaurantName: string
  participants: FinalizeParticipantInput[]
  items: FinalizeItemInput[]
  assignments: FinalizeAssignmentInput[]
}): FinalizeValidationError[] {
  const errors: FinalizeValidationError[] = []

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

export function assertBillCanFinalize(input: {
  restaurantName: string
  participants: FinalizeParticipantInput[]
  items: FinalizeItemInput[]
  assignments: FinalizeAssignmentInput[]
}): void {
  const errors = validateBillForFinalize(input)
  if (errors.length > 0) {
    throw new Error(errors[0].message)
  }
}
