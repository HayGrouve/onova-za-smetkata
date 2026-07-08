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

export function isGuestClaimItemMaxedOutByMe(
  item: Pick<Doc<'items'>, 'quantity'>,
  state: GuestClaimItemState,
): boolean {
  return (
    item.quantity > 1 &&
    state.myUnits > 0 &&
    state.myUnits >= state.remainingUnits
  )
}

export function sortGuestClaimItems<T extends Pick<Doc<'items'>, 'sortOrder'>>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function filterGuestClaimItemsBySearch<T extends Pick<Doc<'items'>, 'name'>>(
  items: T[],
  search: string,
): T[] {
  const query = search.trim().toLowerCase()
  if (!query) return items
  return items.filter((item) => item.name.toLowerCase().includes(query))
}

export function filterUnclaimedGuestClaimItems<
  T extends Pick<Doc<'items'>, '_id' | 'quantity'>,
>(
  items: T[],
  assignments: GuestItemAssignment[],
  participantId: Id<'participants'>,
): T[] {
  return items.filter((item) => {
    const itemAssignments = assignments.filter(
      (assignment) => assignment.itemId === item._id,
    )
    const state = getGuestClaimItemState(item, itemAssignments, participantId)

    if (item.quantity === 1) {
      return !state.isSelectedByMe
    }

    return !isGuestClaimItemMaxedOutByMe(item, state)
  })
}

export function itemUsesUnitAssignments(
  itemId: Id<'items'>,
  assignments: GuestItemAssignment[],
): boolean {
  return assignments
    .filter((assignment) => assignment.itemId === itemId)
    .some((assignment) => assignment.units !== undefined)
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
