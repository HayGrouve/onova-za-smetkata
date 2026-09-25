import { SearchIcon } from 'lucide-react'
import { ClaimGroupRow } from '#/components/bills/claim-group-row.tsx'
import type { ShareCandidate } from '#/components/bills/share-unit-sheet.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { cn } from '#/lib/utils.ts'
import type {
  GuestClaimSessionState,
  GuestClaimTab,
} from '../../../shared/guest-claim-session.ts'
import type { ParticipantInput } from '../../../shared/bill-calculations'
import type { Id } from '../../../convex/_generated/dataModel'

const TAB_LABELS: Record<GuestClaimTab, string> = {
  all: 'Всички',
  free: 'Свободни',
  mine: 'Мои',
}

const TABS: GuestClaimTab[] = ['all', 'free', 'mine']

/** Show search once the list is long enough to need it. */
const SEARCH_MIN_GROUPS = 6

export interface ClaimItemsPanelProps {
  session: GuestClaimSessionState
  itemTab: GuestClaimTab
  onItemTabChange: (tab: GuestClaimTab) => void
  search: string
  onSearchChange: (search: string) => void
  searchInputId: string
  seatId: Id<'participants'>
  participants: ParticipantInput[]
  participantLabels: Record<string, string>
  shareCandidates: ShareCandidate[]
  readOnly: boolean
  sessionToken?: string
}

export function ClaimItemsPanel({
  session,
  itemTab,
  onItemTabChange,
  search,
  onSearchChange,
  searchInputId,
  seatId,
  participants,
  participantLabels,
  shareCandidates,
  readOnly,
  sessionToken,
}: ClaimItemsPanelProps) {
  const { tableProgress, tabCounts } = session
  const progressPercent =
    tableProgress.totalUnits > 0
      ? Math.round(
          (tableProgress.claimedUnits / tableProgress.totalUnits) * 100,
        )
      : 0

  return (
    <>
      {session.hasItems ? (
        <div className="flex flex-col gap-1.5" data-testid="table-progress">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              На масата: {tableProgress.claimedUnits} от{' '}
              {tableProgress.totalUnits} бройки са отбелязани
            </span>
            {tableProgress.freeUnits === 0 ? (
              <span className="font-medium text-success">Готово</span>
            ) : null}
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={tableProgress.totalUnits}
            aria-valuenow={tableProgress.claimedUnits}
            aria-label="Отбелязани бройки на масата"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      {session.hasItems ? (
        <div
          className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/40 p-1"
          role="tablist"
          aria-label="Филтър на артикули"
        >
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={itemTab === tab}
              className={cn(
                'h-11 rounded-md text-sm font-medium transition-colors',
                itemTab === tab
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground',
              )}
              onClick={() => onItemTabChange(tab)}
            >
              {TAB_LABELS[tab]} ({tabCounts[tab]})
            </button>
          ))}
        </div>
      ) : null}

      {tabCounts.all >= SEARCH_MIN_GROUPS || session.hasSearchQuery ? (
        <div className="relative">
          <Label htmlFor={searchInputId} className="sr-only">
            Търсене по артикул
          </Label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchInputId}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Търсене по артикул"
            className="h-11 pl-9"
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {session.emptyMessage ? (
          <p className="text-sm text-muted-foreground">
            {session.emptyMessage}
          </p>
        ) : (
          session.visibleGroups.map((view) => (
            <ClaimGroupRow
              key={view.group.key}
              view={view}
              seatId={seatId}
              participants={participants}
              participantLabels={participantLabels}
              shareCandidates={shareCandidates}
              readOnly={readOnly}
              sessionToken={sessionToken}
            />
          ))
        )}
      </div>
    </>
  )
}
