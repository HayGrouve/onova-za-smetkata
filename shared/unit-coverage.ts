import type { AssignmentInput, ItemInput } from './bill-calculations'

export function itemHasEmptyUnit(
  item: ItemInput,
  assignments: AssignmentInput[],
): boolean {
  for (let unitIndex = 0; unitIndex < item.quantity; unitIndex++) {
    const covered = assignments.some(
      (assignment) =>
        assignment.itemId === item.id && assignment.unitIndex === unitIndex,
    )
    if (!covered) return true
  }
  return false
}

export function countItemsWithEmptyUnits(
  items: ItemInput[],
  assignments: AssignmentInput[],
): number {
  return items.filter((item) => itemHasEmptyUnit(item, assignments)).length
}

export function countCoveredUnits(
  item: ItemInput,
  assignments: AssignmentInput[],
): number {
  let covered = 0
  for (let unitIndex = 0; unitIndex < item.quantity; unitIndex++) {
    if (
      assignments.some(
        (assignment) =>
          assignment.itemId === item.id && assignment.unitIndex === unitIndex,
      )
    ) {
      covered++
    }
  }
  return covered
}

export function itemHasFullUnitCoverage(
  item: ItemInput,
  assignments: AssignmentInput[],
): boolean {
  return !itemHasEmptyUnit(item, assignments)
}

export function participantIdsOnUnit(
  itemId: string,
  unitIndex: number,
  assignments: AssignmentInput[],
): string[] {
  return assignments
    .filter(
      (assignment) =>
        assignment.itemId === itemId && assignment.unitIndex === unitIndex,
    )
    .map((assignment) => assignment.participantId)
}

export function countUnitsJoinedByParticipant(
  itemId: string,
  participantId: string,
  assignments: AssignmentInput[],
): number {
  return assignments.filter(
    (assignment) =>
      assignment.itemId === itemId &&
      assignment.participantId === participantId,
  ).length
}
