import { SearchIcon } from 'lucide-react'
import { GuestItemRow } from '#/components/bills/guest-item-row.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { cn } from '#/lib/utils.ts'
import type {
  GuestClaimSessionState,
  GuestClaimTab,
} from '#/lib/guest-claim-session.ts'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import type { ParticipantInput } from '../../../shared/bill-calculations'

export interface ClaimItemsPanelProps {
  session: GuestClaimSessionState
  itemTab: GuestClaimTab
  onItemTabChange: (tab: GuestClaimTab) => void
  search: string
  onSearchChange: (search: string) => void
  searchInputId: string
  participantId: Id<'participants'>
  participants: ParticipantInput[]
  participantLabels: Record<string, string>
  readOnly: boolean
  sessionToken?: string
  onItemSelected: () => void
  /** Map Convex item docs by id for row rendering. */
  itemDocsById: Map<string, Doc<'items'>>
}

export function ClaimItemsPanel({
  session,
  itemTab,
  onItemTabChange,
  search,
  onSearchChange,
  searchInputId,
  participantId,
  participants,
  participantLabels,
  readOnly,
  sessionToken,
  onItemSelected,
  itemDocsById,
}: ClaimItemsPanelProps) {
  return (
    <>
      {session.hasItems ? (
        <div
          className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-1"
          role="tablist"
          aria-label="Филтър на артикули"
        >
          <button
            type="button"
            role="tab"
            aria-selected={itemTab === 'remaining'}
            className={cn(
              'h-11 rounded-md text-sm font-medium transition-colors',
              itemTab === 'remaining'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
            onClick={() => onItemTabChange('remaining')}
          >
            Остават ({session.remainingCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={itemTab === 'mine'}
            className={cn(
              'h-11 rounded-md text-sm font-medium transition-colors',
              itemTab === 'mine'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
            onClick={() => onItemTabChange('mine')}
          >
            Мои ({session.claimedCount})
          </button>
        </div>
      ) : null}

      {session.showSearch ? (
        <div className="relative z-10">
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
          session.visibleItems.map(({ item, assignments }) => {
            const itemDoc = itemDocsById.get(item.id)
            if (!itemDoc) return null
            return (
              <GuestItemRow
                key={item.id}
                item={itemDoc}
                participantId={participantId}
                participants={participants}
                sessionToken={sessionToken}
                itemAssignments={assignments as Doc<'itemAssignments'>[]}
                participantLabels={participantLabels}
                readOnly={readOnly}
                hidePrices={session.hidePrices}
                onItemSelected={onItemSelected}
              />
            )
          })
        )}
      </div>
    </>
  )
}
