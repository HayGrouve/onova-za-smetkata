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

export function itemHasFullUnitCoverage(
  item: ItemInput,
  assignments: AssignmentInput[],
): boolean {
  return !itemHasEmptyUnit(item, assignments)
}
