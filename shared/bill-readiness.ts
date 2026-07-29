import type {
  AssignmentInput,
  ItemInput,
  ParticipantInput,
} from './bill-calculations'
import { lineTotalCents } from './bill-calculations'
import { itemHasFullUnitCoverage } from './unit-coverage'

export interface BillReadinessInput {
  restaurantName: string
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
  hostParticipantId?: string
}

export interface PreparedBillInput {
  restaurantName: string
  guestCount: number
  items: ItemInput[]
  assignments: AssignmentInput[]
}

export function isRestaurantReady(restaurantName: string): boolean {
  return restaurantName.trim().length > 0
}

export function countGuests(
  participants: ParticipantInput[],
  hostParticipantId?: string,
): number {
  if (!hostParticipantId) {
    return participants.length
  }
  return participants.filter(
    (participant) => participant.id !== hostParticipantId,
  ).length
}

export function hasAtLeastOneGuest(input: {
  participants: ParticipantInput[]
  hostParticipantId?: string
}): boolean {
  return countGuests(input.participants, input.hostParticipantId) >= 1
}

export function hasAtLeastOneParticipant(
  participants: ParticipantInput[],
): boolean {
  return participants.length >= 1
}

/** Every item has a unit price greater than zero. */
export function hasPricedItems(items: ItemInput[]): boolean {
  return items.length > 0 && items.every((item) => item.unitPriceCents > 0)
}

/** At least one item line has a positive total (unit price × quantity). */
export function hasItemsWithPositiveLineTotal(items: ItemInput[]): boolean {
  return items.some((item) => lineTotalCents(item) > 0)
}

export function hasFullUnitCoverageOnAllItems(
  items: ItemInput[],
  assignments: AssignmentInput[],
): boolean {
  return (
    items.length > 0 &&
    items.every((item) => itemHasFullUnitCoverage(item, assignments))
  )
}

/**
 * Prepared bill milestone (CONTEXT.md): restaurant, Guest, priced items,
 * every Unit assigned.
 */
export function isPreparedBill(input: PreparedBillInput): boolean {
  return (
    isRestaurantReady(input.restaurantName) &&
    input.guestCount >= 1 &&
    hasPricedItems(input.items) &&
    hasFullUnitCoverageOnAllItems(input.items, input.assignments)
  )
}

export function isPreparedBillFromParticipants(
  input: BillReadinessInput,
): boolean {
  return isPreparedBill({
    restaurantName: input.restaurantName,
    guestCount: countGuests(input.participants, input.hostParticipantId),
    items: input.items,
    assignments: input.assignments,
  })
}

/** Editor step 3 / allocation guidance: priced items, full Unit coverage. */
export function isAllocationReady(input: {
  items: ItemInput[]
  assignments: AssignmentInput[]
}): boolean {
  return (
    hasPricedItems(input.items) &&
    hasFullUnitCoverageOnAllItems(input.items, input.assignments)
  )
}

/** Step 1 — restaurant name present. */
export function isBillDetailsStepReady(restaurantName: string): boolean {
  return isRestaurantReady(restaurantName)
}

/** Step 2 — at least one Guest (host seat excluded when known). */
export function isParticipantsStepReady(input: {
  participants: ParticipantInput[]
  hostParticipantId?: string
}): boolean {
  return hasAtLeastOneGuest(input)
}
