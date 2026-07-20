import { useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { cn } from '#/lib/utils.ts'
import { formatEur } from '#/lib/format-currency.ts'
import {
  getGuestClaimItemState,
  getOtherClaimantLabels,
} from '#/lib/guest-claim-items.ts'
import {
  formatShareParticipantCount,
  previewShareCents,
} from '#/lib/guest-share-preview.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { SpodeliDialog } from '#/components/bills/spodeli-dialog.tsx'

export interface GuestItemRowProps {
  item: Doc<'items'>
  participantId: Id<'participants'>
  sessionToken?: string
  itemAssignments: Doc<'itemAssignments'>[]
  participantLabels: Record<string, string>
  readOnly: boolean
  onItemSelected?: () => void
}

export function GuestItemRow({
  item,
  participantId,
  sessionToken,
  itemAssignments,
  participantLabels,
  readOnly,
  onItemSelected,
}: GuestItemRowProps) {
  const [spodeliOpen, setSpodeliOpen] = useState(false)
  const toggleAssignment = useMutation(api.assignments.toggle)

  const { myUnits, coveredUnits, isSelectedByMe } = getGuestClaimItemState(
    item,
    itemAssignments,
    participantId,
  )
  const otherClaimants = getOtherClaimantLabels(
    itemAssignments,
    participantId,
    participantLabels,
  )
  const lineTotalCents = item.unitPriceCents * item.quantity
  const assigneeIdsOnUnit0 = itemAssignments
    .filter((assignment) => assignment.unitIndex === 0)
    .map((assignment) => assignment.participantId)

  async function handleToggle() {
    if (readOnly) return
    try {
      await toggleAssignment({ itemId: item._id, participantId, sessionToken })
      onItemSelected?.()
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  const cardClassName = cn(
    'guest-claim-card flex flex-col gap-1 rounded-lg border p-4 text-left',
    'border-border bg-card',
    !readOnly && item.quantity === 1 && 'tap-feedback',
    readOnly && item.quantity === 1 && 'opacity-80',
    item.quantity > 1 && 'tap-feedback',
    item.quantity > 1 && readOnly && 'opacity-80',
    item.quantity === 1 &&
      isSelectedByMe &&
      'guest-claim-card--selected border-primary/50 bg-primary/10 dark:border-primary/40 dark:bg-primary/15',
    item.quantity > 1 &&
      isSelectedByMe &&
      'guest-claim-card--selected border-primary/50 bg-primary/10 dark:border-primary/40 dark:bg-primary/15',
  )

  function renderQty1ShareHint() {
    const shareCents = previewShareCents(
      lineTotalCents,
      assigneeIdsOnUnit0,
      participantId,
      !isSelectedByMe,
    )

    if (isSelectedByMe) {
      return (
        <>
          <p className="text-xs font-medium text-primary">✓ Ваше</p>
          <p className="text-xs text-muted-foreground">
            Вашият дял: {formatEur(shareCents)}
          </p>
        </>
      )
    }

    if (otherClaimants.length > 0) {
      return (
        <>
          <p className="text-xs text-muted-foreground">
            Споделено с {otherClaimants.join(', ')} (
            {formatShareParticipantCount(otherClaimants.length)})
          </p>
          <p className="text-xs text-muted-foreground">
            Вашият дял: {formatEur(shareCents)}
          </p>
          {!readOnly && (
            <p className="text-xs font-medium text-muted-foreground">
              Присъедини се
            </p>
          )}
        </>
      )
    }

    if (!readOnly) {
      return (
        <p className="text-xs font-medium text-muted-foreground">
          Докоснете, за да отбележите
        </p>
      )
    }

    return null
  }

  function renderMultiQtySummary() {
    return (
      <>
        {isSelectedByMe ? (
          <p className="text-xs font-medium text-primary">
            Ваши бройки: {myUnits} от {item.quantity}
          </p>
        ) : null}
        {coveredUnits > 0 ? (
          <p className="text-xs text-muted-foreground">
            {coveredUnits} от {item.quantity} заети
          </p>
        ) : null}
        <p className="text-xs font-medium text-primary">Сподели</p>
      </>
    )
  }

  if (item.quantity === 1) {
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() => void handleToggle()}
        className={cn(cardClassName, 'text-left')}
        aria-label={`${item.name}, докоснете за отбелязване`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatEur(item.unitPriceCents)} × {item.quantity}
            </p>
          </div>
          <p className="money font-medium">{formatEur(lineTotalCents)}</p>
        </div>
        {renderQty1ShareHint()}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setSpodeliOpen(true)}
        className={cn(cardClassName, 'gap-2 text-left')}
        aria-label={`${item.name}, сподели бройки`}
        data-testid={`guest-item-spodeli-${item._id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatEur(item.unitPriceCents)} × {item.quantity}
            </p>
          </div>
          <p className="money font-medium">{formatEur(lineTotalCents)}</p>
        </div>
        {renderMultiQtySummary()}
      </button>
      <SpodeliDialog
        open={spodeliOpen}
        onOpenChange={setSpodeliOpen}
        item={item}
        participantId={participantId}
        sessionToken={sessionToken}
        itemAssignments={itemAssignments}
        participantLabels={participantLabels}
        readOnly={readOnly}
        onUnitToggled={onItemSelected}
      />
    </>
  )
}
