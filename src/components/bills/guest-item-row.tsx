import { useMutation } from 'convex/react'
import { CheckIcon, MinusIcon, PlusIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '#/lib/utils.ts'
import { formatEur } from '#/lib/format-currency.ts'
import {
  getGuestClaimItemState,
  getOtherClaimantLabels,
} from '#/lib/guest-claim-items.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface GuestItemRowProps {
  item: Doc<'items'>
  participantId: Id<'participants'>
  itemAssignments: Doc<'itemAssignments'>[]
  participantLabels: Record<string, string>
  readOnly: boolean
  onItemSelected?: () => void
}

export function GuestItemRow({
  item,
  participantId,
  itemAssignments,
  participantLabels,
  readOnly,
  onItemSelected,
}: GuestItemRowProps) {
  const toggleAssignment = useMutation(api.assignments.toggle)
  const setUnits = useMutation(api.assignments.setUnits)

  const { myUnits, assignedUnitsTotal, remainingUnits, isSelectedByMe, isUnavailableToMe } =
    getGuestClaimItemState(item, itemAssignments, participantId)
  const otherClaimants = getOtherClaimantLabels(
    itemAssignments,
    participantId,
    participantLabels,
  )
  const lineTotalCents = item.unitPriceCents * item.quantity
  const interactionDisabled = readOnly || isUnavailableToMe

  async function handleToggle() {
    if (interactionDisabled) return
    const wasSelected = isSelectedByMe
    try {
      await toggleAssignment({ itemId: item._id, participantId })
      if (!wasSelected) onItemSelected?.()
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handleSetUnits(units: number) {
    if (readOnly) return
    try {
      await setUnits({ itemId: item._id, participantId, units })
      if (units > myUnits) onItemSelected?.()
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  const cardClassName = cn(
    'guest-claim-card flex flex-col gap-1 rounded-lg border p-4 text-left',
    isSelectedByMe
      ? 'guest-claim-card--selected border-primary/50 bg-primary/10 dark:border-primary/40 dark:bg-primary/15'
      : isUnavailableToMe
        ? 'guest-claim-card--unavailable border-border/60 bg-muted/30'
        : 'border-border bg-card',
    !interactionDisabled && 'tap-feedback',
    readOnly && !isUnavailableToMe && 'opacity-80',
  )

  function renderClaimantHint() {
    if (otherClaimants.length === 0) return null

    if (isUnavailableToMe) {
      return (
        <p className="text-xs font-medium text-muted-foreground">
          Заето от {otherClaimants.join(', ')}
        </p>
      )
    }

    return (
      <p className="text-xs text-muted-foreground">
        {otherClaimants.join(', ')} · {assignedUnitsTotal}/{item.quantity} разпределени
      </p>
    )
  }

  if (item.quantity === 1) {
    return (
      <button
        type="button"
        disabled={interactionDisabled}
        onClick={() => void handleToggle()}
        className={cn(cardClassName, 'text-left')}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatEur(item.unitPriceCents)} × {item.quantity}
            </p>
          </div>
          <p className="font-medium tabular-nums">{formatEur(lineTotalCents)}</p>
        </div>
        {renderClaimantHint()}
        {!readOnly && !isUnavailableToMe && (
          <p
            key={isSelectedByMe ? 'claimed' : 'open'}
            className={cn(
              'guest-status-in flex items-center gap-1 text-xs font-medium',
              isSelectedByMe ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {isSelectedByMe ? (
              <>
                <CheckIcon className="size-3.5" aria-hidden />
                Отбелязано
              </>
            ) : (
              'Докоснете, за да отбележите'
            )}
          </p>
        )}
      </button>
    )
  }

  return (
    <div className={cn(cardClassName, 'gap-2')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatEur(item.unitPriceCents)} × {item.quantity}
          </p>
        </div>
        <p className="font-medium tabular-nums">{formatEur(lineTotalCents)}</p>
      </div>
      {renderClaimantHint()}
      {!readOnly && !isUnavailableToMe && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/40 px-3 py-2.5 dark:border-input dark:bg-input/40">
          <span className="text-sm font-medium text-foreground">Ваши бройки</span>
          <div className="flex items-center gap-1 rounded-full border border-primary/50 bg-background/80 pl-1 pr-1 dark:border-primary/40 dark:bg-background/60">
            <button
              type="button"
              aria-label="Намали"
              disabled={myUnits <= 0}
              onClick={() => void handleSetUnits(myUnits - 1)}
              className="tap-feedback flex size-8 items-center justify-center rounded-full text-foreground hover:bg-foreground/10 disabled:opacity-40"
            >
              <MinusIcon className="size-4" />
            </button>
            <span
              key={myUnits}
              className="guest-count-pop min-w-8 text-center text-sm font-semibold tabular-nums text-foreground"
            >
              {myUnits}
            </span>
            <button
              type="button"
              aria-label="Увеличи"
              disabled={myUnits >= remainingUnits}
              onClick={() => void handleSetUnits(myUnits + 1)}
              className="tap-feedback flex size-8 items-center justify-center rounded-full text-foreground hover:bg-foreground/10 disabled:opacity-40"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
