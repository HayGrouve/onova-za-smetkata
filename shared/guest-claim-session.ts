import type {
  BillCalculationContext,
  LoadedBillRelations,
} from './bill-calculation-snapshot'
import { toBillCalculationSnapshot } from './bill-calculation-snapshot'
import type {
  BillBreakdownInput,
  ParticipantInput,
  ParticipantTotals,
} from './bill-calculations'
import { calculateBillTotals } from './bill-calculations'
import { buildClaimGroupSeatView, groupClaimItems } from './claim-groups'
import type { GuestItemAssignment } from './guest-claim-items'

export interface GuestClaimSessionItem {
  id: string
  name: string
  quantity: number
  sortOrder: number
  unitPriceCents: number
}

export interface GuestClaimSessionInput {
  items: GuestClaimSessionItem[]
  assignments: GuestItemAssignment[]
  participants: ParticipantInput[]
  /** Seat the claim actions act for. */
  seatId: string
  /** Every seat this phone handles (own + Covered seats). Defaults to `seatId`. */
  mySeatIds?: string[]
  billRelations?: LoadedBillRelations
  billContext?: BillCalculationContext
}

export interface GuestClaimSeatShare {
  seatId: string
  breakdownInput: BillBreakdownInput
  totals: ParticipantTotals
}

export interface GuestClaimSessionState {
  tableProgress: { claimedUnits: number; totalUnits: number; freeUnits: number }
  seatShares: GuestClaimSeatShare[]
}

function buildSeatShares(input: GuestClaimSessionInput): GuestClaimSeatShare[] {
  const { billRelations, billContext } = input
  if (!billRelations) return []

  const snapshot = toBillCalculationSnapshot(billRelations, billContext ?? {})
  const totals = calculateBillTotals(snapshot.calculationInput)
  const seatIds = input.mySeatIds ?? [input.seatId]

  return seatIds
    .filter((seatId) => seatId in totals.byParticipant)
    .map((seatId) => ({
      seatId,
      breakdownInput: snapshot.breakdownInput,
      totals: totals.byParticipant[seatId],
    }))
}

/** What a guest phone needs to pay: table progress in Units and per-seat Shares. */
export function buildGuestClaimSessionState(
  input: GuestClaimSessionInput,
): GuestClaimSessionState {
  const { assignments, participants, seatId } = input

  const tableProgress = groupClaimItems(input.items)
    .map((group) =>
      buildClaimGroupSeatView({ group, assignments, seatId, participants }),
    )
    .reduce(
      (progress, view) => ({
        claimedUnits: progress.claimedUnits + view.claimedUnitCount,
        totalUnits: progress.totalUnits + view.totalUnits,
        freeUnits: progress.freeUnits + view.freeUnits.length,
      }),
      { claimedUnits: 0, totalUnits: 0, freeUnits: 0 },
    )

  return { tableProgress, seatShares: buildSeatShares(input) }
}
