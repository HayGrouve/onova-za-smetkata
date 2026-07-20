import type { Doc, Id } from '../../convex/_generated/dataModel'
import {
  countCoveredUnits,
  countUnitsJoinedByParticipant,
} from '../../shared/unit-coverage'

export interface GuestItemAssignment {
  itemId: Id<'items'>
  participantId: Id<'participants'>
  unitIndex: number
}

export interface GuestClaimItemState {
  myUnits: number
  coveredUnits: number
  isSelectedByMe: boolean
}

export function getGuestClaimItemState(
  item: Pick<Doc<'items'>, '_id' | 'quantity'>,
  itemAssignments: GuestItemAssignment[],
  participantId: Id<'participants'>,
): GuestClaimItemState {
  const itemInput = {
    id: item._id,
    unitPriceCents: 0,
    quantity: item.quantity,
  }
  const coveredUnits = countCoveredUnits(
    itemInput,
    itemAssignments.map((assignment) => ({
      itemId: assignment.itemId,
      participantId: assignment.participantId,
      unitIndex: assignment.unitIndex,
    })),
  )
  const myUnits = countUnitsJoinedByParticipant(
    item._id,
    participantId,
    itemAssignments.map((assignment) => ({
      itemId: assignment.itemId,
      participantId: assignment.participantId,
      unitIndex: assignment.unitIndex,
    })),
  )

  return {
    myUnits,
    coveredUnits,
    isSelectedByMe: myUnits > 0,
  }
}

export function sortGuestClaimItems<T extends Pick<Doc<'items'>, 'sortOrder'>>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function filterGuestClaimItemsBySearch<
  T extends Pick<Doc<'items'>, 'name'>,
>(items: T[], search: string): T[] {
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

    return state.myUnits < item.quantity
  })
}

export function filterClaimedGuestClaimItems<
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
    return state.isSelectedByMe
  })
}

export function getOtherClaimantLabels(
  itemAssignments: GuestItemAssignment[],
  participantId: Id<'participants'>,
  labels: Record<string, string>,
): string[] {
  const others = new Set<string>()
  for (const assignment of itemAssignments) {
    if (assignment.participantId === participantId) continue
    others.add(labels[assignment.participantId] ?? assignment.participantId)
  }
  return [...others]
}

export function getAssigneeIdsOnUnit(
  itemAssignments: GuestItemAssignment[],
  unitIndex: number,
): Id<'participants'>[] {
  return itemAssignments
    .filter((assignment) => assignment.unitIndex === unitIndex)
    .map((assignment) => assignment.participantId)
}

export function isParticipantOnUnit(
  itemAssignments: GuestItemAssignment[],
  unitIndex: number,
  participantId: Id<'participants'>,
): boolean {
  return itemAssignments.some(
    (assignment) =>
      assignment.unitIndex === unitIndex &&
      assignment.participantId === participantId,
  )
}

export function getOtherClaimantLabelsForUnit(
  itemAssignments: GuestItemAssignment[],
  unitIndex: number,
  participantId: Id<'participants'>,
  labels: Record<string, string>,
): string[] {
  return getOtherClaimantLabels(
    itemAssignments.filter((assignment) => assignment.unitIndex === unitIndex),
    participantId,
    labels,
  )
}

export function formatSpodeliUnitTitle(
  itemName: string,
  unitIndex: number,
): string {
  return `${itemName} · бройка ${unitIndex + 1}`
}
