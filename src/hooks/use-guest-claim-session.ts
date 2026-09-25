import { useMemo, useState } from 'react'
import type {
  BillCalculationContext,
  LoadedBillRelations,
} from '../../shared/bill-calculation-snapshot'
import type { ParticipantInput } from '../../shared/bill-calculations'
import { buildGuestClaimSessionState } from '../../shared/guest-claim-session'
import type {
  GuestClaimSessionItem,
  GuestClaimSessionState,
  GuestClaimTab,
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

export interface UseGuestClaimSessionResult {
  itemTab: GuestClaimTab
  setItemTab: (tab: GuestClaimTab) => void
  search: string
  setSearch: (search: string) => void
  clearSearch: () => void
  session: GuestClaimSessionState | null
}

export function useGuestClaimSession({
  items,
  assignments,
  participants,
  seatId,
  mySeatIds,
  billRelations,
  billContext,
}: UseGuestClaimSessionOptions): UseGuestClaimSessionResult {
  const [itemTab, setItemTab] = useState<GuestClaimTab>('all')
  const [search, setSearch] = useState('')

  const session = useMemo(() => {
    if (!seatId) return null
    return buildGuestClaimSessionState({
      items,
      assignments,
      participants,
      seatId,
      mySeatIds,
      activeTab: itemTab,
      search,
      billRelations,
      billContext,
    })
  }, [
    assignments,
    billContext,
    billRelations,
    itemTab,
    items,
    mySeatIds,
    participants,
    search,
    seatId,
  ])

  return {
    itemTab,
    setItemTab,
    search,
    setSearch,
    clearSearch: () => setSearch(''),
    session,
  }
}
