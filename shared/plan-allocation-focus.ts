import type { AssignmentInput, ItemInput } from './bill-calculations.ts'
import { itemHasFullUnitCoverage } from './unit-coverage.ts'

export type AllocationFocusKind = 'add-item' | 'fix-price' | 'assign'

/** Which allocation control should receive scroll+pop for the active allocation hint. */
export function resolveAllocationFocusKind(
  items: ItemInput[],
  assignments: AssignmentInput[],
): AllocationFocusKind | null {
  if (items.length === 0) return 'add-item'

  if (items.some((item) => item.unitPriceCents <= 0)) {
    return 'fix-price'
  }

  if (items.some((item) => !itemHasFullUnitCoverage(item, assignments))) {
    return 'assign'
  }

  return null
}

export function firstUnpricedItemId(items: ItemInput[]): string | undefined {
  return items.find((item) => item.unitPriceCents <= 0)?.id
}

export function firstUnassignedItemId(
  items: ItemInput[],
  assignments: AssignmentInput[],
): string | undefined {
  return items.find((item) => !itemHasFullUnitCoverage(item, assignments))?.id
}
