import { useMemo, useState } from 'react'
import type {
  BillCalculationContext,
  LoadedBillRelations,
} from '../../shared/bill-calculation-snapshot'
import { buildGuestClaimSessionState } from '../../shared/guest-claim-session'
import type {
  GuestClaimSessionState,
  GuestClaimTab,
} from '../../shared/guest-claim-session'
import type { GuestItemAssignment } from '../../shared/guest-claim-items'

export interface GuestClaimSessionItemInput {
  id: string
  name: string
  quantity: number
  sortOrder: number
}

export interface UseGuestClaimSessionOptions {
  items: GuestClaimSessionItemInput[]
  assignments: GuestItemAssignment[]
  participantId: string | null
  billRelations?: LoadedBillRelations
  billContext?: BillCalculationContext
  participantLabels?: Record<string, string>
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
  participantId,
  billRelations,
  billContext,
  participantLabels,
}: UseGuestClaimSessionOptions): UseGuestClaimSessionResult {
  const [itemTab, setItemTab] = useState<GuestClaimTab>('remaining')
  const [search, setSearch] = useState('')

  const session = useMemo(() => {
    if (!participantId) return null
    return buildGuestClaimSessionState({
      items,
      assignments,
      participantId,
      activeTab: itemTab,
      search,
      billRelations,
      billContext,
      participantLabels,
    })
  }, [
    assignments,
    billContext,
    billRelations,
    itemTab,
    items,
    participantId,
    participantLabels,
    search,
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
