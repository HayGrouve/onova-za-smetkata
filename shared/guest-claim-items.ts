import {
  countCoveredUnits,
  countUnitsJoinedByParticipant,
  formatUnitTitle,
  isParticipantOnUnit as isParticipantAssignedToUnit,
  otherParticipantLabelsOnItem,
  otherParticipantLabelsOnUnit,
  participantIdsOnUnit,
} from './unit-coverage'

export interface GuestItemAssignment {
  itemId: string
  participantId: string
  unitIndex: number
}

export interface GuestClaimItemState {
  myUnits: number
  coveredUnits: number
  isSelectedByMe: boolean
}

type GuestClaimItemRef =
  | Pick<{ id: string; quantity: number }, 'id' | 'quantity'>
  | Pick<{ _id: string; quantity: number }, '_id' | 'quantity'>

function readItemId(item: GuestClaimItemRef): string {
  if ('id' in item) return item.id
  return item._id
}

function toAssignmentInputs(assignments: GuestItemAssignment[]) {
  return assignments.map((assignment) => ({
    itemId: assignment.itemId,
    participantId: assignment.participantId,
    unitIndex: assignment.unitIndex,
  }))
}

export function getGuestClaimItemState(
  item: GuestClaimItemRef,
  itemAssignments: GuestItemAssignment[],
  participantId: string,
): GuestClaimItemState {
  const itemId = readItemId(item)
  const itemInput = {
    id: itemId,
    unitPriceCents: 0,
    quantity: item.quantity,
  }
  const assignmentInputs = toAssignmentInputs(itemAssignments)
  const coveredUnits = countCoveredUnits(itemInput, assignmentInputs)
  const myUnits = countUnitsJoinedByParticipant(
    itemId,
    participantId,
    assignmentInputs,
  )

  return {
    myUnits,
    coveredUnits,
    isSelectedByMe: myUnits > 0,
  }
}

export function sortGuestClaimItems<
  T extends Pick<{ sortOrder: number }, 'sortOrder'>,
>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function filterGuestClaimItemsBySearch<
  T extends Pick<{ name: string }, 'name'>,
>(items: T[], search: string): T[] {
  const query = search.trim().toLowerCase()
  if (!query) return items
  return items.filter((item) => item.name.toLowerCase().includes(query))
}

export function filterUnclaimedGuestClaimItems<T extends GuestClaimItemRef>(
  items: T[],
  assignments: GuestItemAssignment[],
  participantId: string,
): T[] {
  return items.filter((item) => {
    const itemId = readItemId(item)
    const itemAssignments = assignments.filter(
      (assignment) => assignment.itemId === itemId,
    )
    const state = getGuestClaimItemState(item, itemAssignments, participantId)

    if (item.quantity === 1) {
      return !state.isSelectedByMe
    }

    return state.myUnits < item.quantity
  })
}

export function filterClaimedGuestClaimItems<T extends GuestClaimItemRef>(
  items: T[],
  assignments: GuestItemAssignment[],
  participantId: string,
): T[] {
  return items.filter((item) => {
    const itemId = readItemId(item)
    const itemAssignments = assignments.filter(
      (assignment) => assignment.itemId === itemId,
    )
    const state = getGuestClaimItemState(item, itemAssignments, participantId)
    return state.isSelectedByMe
  })
}

export function getOtherClaimantLabels(
  itemAssignments: GuestItemAssignment[],
  participantId: string,
  labels: Record<string, string>,
): string[] {
  if (itemAssignments.length === 0) return []
  const itemId = itemAssignments[0].itemId
  return otherParticipantLabelsOnItem(
    itemId,
    participantId,
    toAssignmentInputs(itemAssignments),
    labels,
  )
}

export function getAssigneeIdsOnUnit(
  itemAssignments: GuestItemAssignment[],
  unitIndex: number,
): string[] {
  if (itemAssignments.length === 0) return []
  const itemId = itemAssignments[0].itemId
  return participantIdsOnUnit(
    itemId,
    unitIndex,
    toAssignmentInputs(itemAssignments),
  )
}

export function isParticipantOnUnit(
  itemAssignments: GuestItemAssignment[],
  unitIndex: number,
  participantId: string,
): boolean {
  if (itemAssignments.length === 0) return false
  const itemId = itemAssignments[0].itemId
  return isParticipantAssignedToUnit(
    itemId,
    unitIndex,
    participantId,
    toAssignmentInputs(itemAssignments),
  )
}

export function getOtherClaimantLabelsForUnit(
  itemAssignments: GuestItemAssignment[],
  unitIndex: number,
  participantId: string,
  labels: Record<string, string>,
): string[] {
  if (itemAssignments.length === 0) return []
  const itemId = itemAssignments[0].itemId
  return otherParticipantLabelsOnUnit(
    itemId,
    unitIndex,
    participantId,
    toAssignmentInputs(itemAssignments),
    labels,
  )
}

export function formatSpodeliUnitTitle(
  itemName: string,
  unitIndex: number,
): string {
  return formatUnitTitle(itemName, unitIndex)
}
