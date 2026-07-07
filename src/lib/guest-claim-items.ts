import type { Doc, Id } from '../../convex/_generated/dataModel'

export interface GuestItemAssignment {
  itemId: Id<'items'>
  participantId: Id<'participants'>
  units?: number
}

export interface GuestClaimItemState {
  myUnits: number
  assignedUnitsTotal: number
  remainingUnits: number
  isSelectedByMe: boolean
  isUnavailableToMe: boolean
}

export function getGuestClaimItemState(
  item: Pick<Doc<'items'>, '_id' | 'quantity'>,
  itemAssignments: GuestItemAssignment[],
  participantId: Id<'participants'>,
): GuestClaimItemState {
  const myAssignment = itemAssignments.find(
    (assignment) => assignment.participantId === participantId,
  )
  const myUnits = myAssignment?.units ?? 0
  const assignedUnitsTotal = itemAssignments.reduce(
    (sum, assignment) => sum + (assignment.units ?? 0),
    0,
  )
  const remainingUnits = Math.max(0, item.quantity - assignedUnitsTotal + myUnits)

  return {
    myUnits,
    assignedUnitsTotal,
    remainingUnits,
    isSelectedByMe: myUnits > 0,
    isUnavailableToMe: myUnits === 0 && remainingUnits === 0,
  }
}

export function compareGuestClaimItemNames(
  a: Pick<Doc<'items'>, 'name'>,
  b: Pick<Doc<'items'>, 'name'>,
): number {
  return a.name.localeCompare(b.name, 'bg', { sensitivity: 'base' })
}

export function sortGuestClaimItems<T extends Pick<Doc<'items'>, '_id' | 'name' | 'quantity'>>(
  items: T[],
  assignments: GuestItemAssignment[],
  participantId: Id<'participants'>,
): T[] {
  const available: T[] = []
  const unavailable: T[] = []
  const selected: T[] = []

  for (const item of items) {
    const itemAssignments = assignments.filter(
      (assignment) => assignment.itemId === item._id,
    )
    const state = getGuestClaimItemState(item, itemAssignments, participantId)

    if (state.isSelectedByMe) {
      selected.push(item)
    } else if (state.isUnavailableToMe) {
      unavailable.push(item)
    } else {
      available.push(item)
    }
  }

  const sortBucket = (bucket: T[]) =>
    [...bucket].sort(compareGuestClaimItemNames)

  return [
    ...sortBucket(available),
    ...sortBucket(unavailable),
    ...sortBucket(selected),
  ]
}

export function filterGuestClaimItemsBySearch<T extends Pick<Doc<'items'>, 'name'>>(
  items: T[],
  search: string,
): T[] {
  const query = search.trim().toLowerCase()
  if (!query) return items
  return items.filter((item) => item.name.toLowerCase().includes(query))
}

export function getOtherClaimantLabels(
  itemAssignments: GuestItemAssignment[],
  participantId: Id<'participants'>,
  labels: Record<string, string>,
): string[] {
  return itemAssignments
    .filter(
      (assignment) =>
        assignment.participantId !== participantId && (assignment.units ?? 0) > 0,
    )
    .map(
      (assignment) =>
        labels[assignment.participantId] ?? assignment.participantId,
    )
}
