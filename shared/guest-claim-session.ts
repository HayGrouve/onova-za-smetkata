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
import type { ClaimGroup, ClaimGroupSeatView } from './claim-groups'
import { filterGuestClaimItemsBySearch } from './guest-claim-items'
import type { GuestItemAssignment } from './guest-claim-items'

export type GuestClaimTab = 'all' | 'free' | 'mine'

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
  activeTab: GuestClaimTab
  search: string
  billRelations?: LoadedBillRelations
  billContext?: BillCalculationContext
}

export interface GuestClaimGroupView {
  group: ClaimGroup
  seat: ClaimGroupSeatView
}

export interface GuestClaimSeatShare {
  seatId: string
  breakdownInput: BillBreakdownInput
  totals: ParticipantTotals
}

export interface GuestClaimSessionState {
  visibleGroups: GuestClaimGroupView[]
  tabCounts: Record<GuestClaimTab, number>
  tableProgress: { claimedUnits: number; totalUnits: number; freeUnits: number }
  hasItems: boolean
  hasSearchQuery: boolean
  emptyMessage: string | null
  seatShares: GuestClaimSeatShare[]
}

export const GUEST_CLAIM_EMPTY_MESSAGES = {
  noItems: 'Все още няма артикули.',
  noSearchResults: 'Няма артикули, съответстващи на търсенето.',
  noClaimed: 'Все още не сте отбелязали нищо.',
  allClaimed: 'Всички бройки са отбелязани.',
} as const

export function resolveGuestClaimEmptyMessage(
  hasItems: boolean,
  visibleCount: number,
  hasSearchQuery: boolean,
  activeTab: GuestClaimTab,
): string | null {
  if (!hasItems) return GUEST_CLAIM_EMPTY_MESSAGES.noItems
  if (visibleCount > 0) return null
  if (hasSearchQuery) return GUEST_CLAIM_EMPTY_MESSAGES.noSearchResults
  if (activeTab === 'mine') return GUEST_CLAIM_EMPTY_MESSAGES.noClaimed
  if (activeTab === 'free') return GUEST_CLAIM_EMPTY_MESSAGES.allClaimed
  return null
}

function matchesTab(view: GuestClaimGroupView, tab: GuestClaimTab): boolean {
  if (tab === 'free') return view.seat.freeUnits.length > 0
  if (tab === 'mine') return view.seat.myUnitCount > 0
  return true
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

export function buildGuestClaimSessionState(
  input: GuestClaimSessionInput,
): GuestClaimSessionState {
  const { assignments, participants, seatId, activeTab, search } = input

  const allGroups: GuestClaimGroupView[] = groupClaimItems(input.items).map(
    (group) => ({
      group,
      seat: buildClaimGroupSeatView({
        group,
        assignments,
        seatId,
        participants,
      }),
    }),
  )

  const tabCounts: Record<GuestClaimTab, number> = {
    all: allGroups.length,
    free: allGroups.filter((view) => matchesTab(view, 'free')).length,
    mine: allGroups.filter((view) => matchesTab(view, 'mine')).length,
  }

  const tableProgress = allGroups.reduce(
    (progress, view) => ({
      claimedUnits: progress.claimedUnits + view.seat.claimedUnitCount,
      totalUnits: progress.totalUnits + view.seat.totalUnits,
      freeUnits: progress.freeUnits + view.seat.freeUnits.length,
    }),
    { claimedUnits: 0, totalUnits: 0, freeUnits: 0 },
  )

  const tabFiltered = allGroups.filter((view) => matchesTab(view, activeTab))
  const searchMatches = new Set(
    filterGuestClaimItemsBySearch(
      tabFiltered.map((view) => view.group),
      search,
    ),
  )
  const visibleGroups = tabFiltered.filter((view) =>
    searchMatches.has(view.group),
  )

  const hasItems = input.items.length > 0
  const hasSearchQuery = search.trim().length > 0

  return {
    visibleGroups,
    tabCounts,
    tableProgress,
    hasItems,
    hasSearchQuery,
    emptyMessage: resolveGuestClaimEmptyMessage(
      hasItems,
      visibleGroups.length,
      hasSearchQuery,
      activeTab,
    ),
    seatShares: buildSeatShares(input),
  }
}
