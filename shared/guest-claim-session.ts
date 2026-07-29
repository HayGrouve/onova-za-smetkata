import type {
  BillCalculationContext,
  LoadedBillRelations,
} from './bill-calculation-snapshot'
import { toBillCalculationSnapshot } from './bill-calculation-snapshot'
import type { BillBreakdownInput, ParticipantTotals } from './bill-calculations'
import { calculateBillTotals } from './bill-calculations'
import {
  filterClaimedGuestClaimItems,
  filterGuestClaimItemsBySearch,
  filterUnclaimedGuestClaimItems,
  getGuestClaimItemState,
  sortGuestClaimItems,
} from './guest-claim-items'
import type {
  GuestClaimItemState,
  GuestItemAssignment,
} from './guest-claim-items'
import { buildParticipantShareView } from './participant-share-view'
import type { ParticipantShareView } from './participant-share-view'

export type GuestClaimTab = 'remaining' | 'mine'

export interface GuestClaimSessionItem {
  id: string
  name: string
  quantity: number
  sortOrder: number
}

export interface GuestClaimSessionInput {
  items: GuestClaimSessionItem[]
  assignments: GuestItemAssignment[]
  participantId: string
  activeTab: GuestClaimTab
  search: string
  billRelations?: LoadedBillRelations
  billContext?: BillCalculationContext
  participantLabels?: Record<string, string>
}

export interface GuestClaimSessionItemView {
  item: GuestClaimSessionItem
  claimState: GuestClaimItemState
  assignments: GuestItemAssignment[]
}

export interface GuestClaimShareDrawerInput {
  breakdownInput: BillBreakdownInput
  participantTotals: ParticipantTotals
  shareView: ParticipantShareView
}

export interface GuestClaimSessionState {
  visibleItems: GuestClaimSessionItemView[]
  remainingCount: number
  claimedCount: number
  hasItems: boolean
  hasSearchQuery: boolean
  hasUnclaimedItems: boolean
  showSearch: boolean
  emptyMessage: string | null
  hidePrices: boolean
  assignmentsByItemId: Record<string, GuestItemAssignment[]>
  shareDrawer?: GuestClaimShareDrawerInput
}

export const GUEST_CLAIM_EMPTY_MESSAGES = {
  noItems: 'Все още няма артикули.',
  noSearchResults: 'Няма артикули, съответстващи на търсенето.',
  noClaimed: 'Все още няма отбелязани артикули.',
  allClaimed: 'Всички артикули са отбелязани.',
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
  return GUEST_CLAIM_EMPTY_MESSAGES.allClaimed
}

function indexAssignmentsByItemId(
  assignments: GuestItemAssignment[],
): Record<string, GuestItemAssignment[]> {
  const map: Record<string, GuestItemAssignment[]> = {}
  for (const assignment of assignments) {
    const list = map[assignment.itemId] ?? []
    list.push(assignment)
    map[assignment.itemId] = list
  }
  return map
}

function buildShareDrawerInput(
  input: GuestClaimSessionInput,
): GuestClaimShareDrawerInput | undefined {
  const { billRelations, billContext, participantId, participantLabels } = input
  if (!billRelations) return undefined

  const snapshot = toBillCalculationSnapshot(billRelations, billContext ?? {})
  const totals = calculateBillTotals(snapshot.calculationInput)
  if (!(participantId in totals.byParticipant)) return undefined

  const participantTotals = totals.byParticipant[participantId]
  const shareView = buildParticipantShareView({
    breakdownInput: snapshot.breakdownInput,
    totals: participantTotals,
    participantId,
    participantLabels,
  })

  return {
    breakdownInput: snapshot.breakdownInput,
    participantTotals,
    shareView,
  }
}

export function buildGuestClaimSessionState(
  input: GuestClaimSessionInput,
): GuestClaimSessionState {
  const { items, assignments, participantId, activeTab, search } = input
  const assignmentsByItemId = indexAssignmentsByItemId(assignments)
  const sorted = sortGuestClaimItems(items)

  const tabFiltered =
    activeTab === 'mine'
      ? filterClaimedGuestClaimItems(sorted, assignments, participantId)
      : filterUnclaimedGuestClaimItems(sorted, assignments, participantId)

  const filtered = filterGuestClaimItemsBySearch(tabFiltered, search)
  const hidePrices = activeTab === 'mine'
  const hasItems = items.length > 0
  const hasSearchQuery = search.trim().length > 0

  const remainingCount = filterUnclaimedGuestClaimItems(
    items,
    assignments,
    participantId,
  ).length
  const claimedCount = filterClaimedGuestClaimItems(
    items,
    assignments,
    participantId,
  ).length

  const visibleItems: GuestClaimSessionItemView[] = filtered.map((item) => ({
    item,
    assignments: assignmentsByItemId[item.id] ?? [],
    claimState: getGuestClaimItemState(
      item,
      assignmentsByItemId[item.id] ?? [],
      participantId,
    ),
  }))

  return {
    visibleItems,
    remainingCount,
    claimedCount,
    hasItems,
    hasSearchQuery,
    hasUnclaimedItems: remainingCount > 0,
    showSearch: remainingCount > 0 || activeTab === 'mine',
    emptyMessage: resolveGuestClaimEmptyMessage(
      hasItems,
      visibleItems.length,
      hasSearchQuery,
      activeTab,
    ),
    hidePrices,
    assignmentsByItemId,
    shareDrawer: buildShareDrawerInput(input),
  }
}
