import { useMemo } from 'react'
import type {
  BillCalculationContext,
  LoadedBillRelations,
} from '../../shared/bill-calculation-snapshot'
import type { ParticipantInput } from '../../shared/bill-calculations'
import { buildGuestClaimSessionState } from '../../shared/guest-claim-session'
import type {
  GuestClaimSessionItem,
  GuestClaimSessionState,
} from '../../shared/guest-claim-session'
import type { GuestItemAssignment } from '../../shared/guest-claim-items'

export interface UseGuestClaimSessionOptions {
  items: GuestClaimSessionItem[]
  assignments: GuestItemAssignment[]
  participants: ParticipantInput[]
  seatId: string | null
  mySeatIds?: string[]
  billRelations?: LoadedBillRelations
  billContext?: BillCalculationContext
}

/** Table progress and per-seat Shares for a guest phone (the Pay step). */
export function useGuestClaimSession({
  items,
  assignments,
  participants,
  seatId,
  mySeatIds,
  billRelations,
  billContext,
}: UseGuestClaimSessionOptions): { session: GuestClaimSessionState | null } {
  const session = useMemo(() => {
    if (!seatId) return null
    return buildGuestClaimSessionState({
      items,
      assignments,
      participants,
      seatId,
      mySeatIds,
      billRelations,
      billContext,
    })
  }, [
    assignments,
    billContext,
    billRelations,
    items,
    mySeatIds,
    participants,
    seatId,
  ])

  return { session }
}
