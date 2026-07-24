import { useState } from 'react'
import { useMutation } from 'convex/react'
import { CircleXIcon } from 'lucide-react'
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
import type { ParticipantInput } from '../../../shared/bill-calculations'

import { SpodeliDialog } from '#/components/bills/spodeli-dialog.tsx'

export interface GuestItemRowProps {
  item: Doc<'items'>
  participantId: Id<'participants'>
  participants: ParticipantInput[]
  sessionToken?: string
  itemAssignments: Doc<'itemAssignments'>[]
  participantLabels: Record<string, string>
  readOnly: boolean
  /** Hide line/unit prices — e.g. on the „Мои“ tab where the footer drawer shows totals. */
  hidePrices?: boolean
  onItemSelected?: () => void
}

export function GuestItemRow({
  item,
  participantId,
  participants,
  sessionToken,
  itemAssignments,
  participantLabels,
  readOnly,
  hidePrices = false,
  onItemSelected,
}: GuestItemRowProps) {
  const [spodeliOpen, setSpodeliOpen] = useState(false)
  const toggleAssignment = useMutation(api.assignments.toggle)
  const leaveUnit = useMutation(api.assignments.leaveUnit)

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

  async function handleRemoveAllMyUnits() {
    if (readOnly) return
    const myRows = itemAssignments.filter(
      (assignment) =>
        assignment.itemId === item._id &&
        assignment.participantId === participantId,
    )
    try {
      for (const row of myRows) {
        await leaveUnit({
          itemId: item._id,
          participantId,
          unitIndex: row.unitIndex,
          sessionToken,
        })
      }
      onItemSelected?.()
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  function handleMultiQtyCardClick() {
    if (hidePrices && isSelectedByMe) {
      void handleRemoveAllMyUnits()
      return
    }
    setSpodeliOpen(true)
  }

  function renderHeaderTrailing() {
    if (hidePrices && isSelectedByMe) {
      return (
        <CircleXIcon
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      )
    }
    if (!hidePrices) {
      return <p className="money font-medium">{formatEur(lineTotalCents)}</p>
    }
    return null
  }

  const mineTabRemoveLabel = ', докоснете за премахване'

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
      item.unitPriceCents,
      assigneeIdsOnUnit0,
      participantId,
      !isSelectedByMe,
      participants,
    )

    if (isSelectedByMe) {
      return (
        <>
          <p className="text-xs font-medium text-primary">✓ Ваше</p>
          {!hidePrices ? (
            <p className="text-xs text-muted-foreground">
              Вашият дял: {formatEur(shareCents)}
            </p>
          ) : null}
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
          {!hidePrices ? (
            <p className="text-xs text-muted-foreground">
              Вашият дял: {formatEur(shareCents)}
            </p>
          ) : null}
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
        {hidePrices && isSelectedByMe ? null : (
          <p className="text-xs font-medium text-primary">Сподели</p>
        )}
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
        aria-label={
          hidePrices && isSelectedByMe
            ? `${item.name}${mineTabRemoveLabel}`
            : `${item.name}, докоснете за отбелязване`
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{item.name}</p>
            {!hidePrices ? (
              <p className="text-sm text-muted-foreground">
                {formatEur(item.unitPriceCents)} × {item.quantity}
              </p>
            ) : null}
          </div>
          {renderHeaderTrailing()}
        </div>
        {renderQty1ShareHint()}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        disabled={readOnly}
        onClick={handleMultiQtyCardClick}
        className={cn(cardClassName, 'gap-2 text-left')}
        aria-label={
          hidePrices && isSelectedByMe
            ? `${item.name}${mineTabRemoveLabel}`
            : `${item.name}, сподели бройки`
        }
        data-testid={`guest-item-spodeli-${item._id}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{item.name}</p>
            {!hidePrices ? (
              <p className="text-sm text-muted-foreground">
                {formatEur(item.unitPriceCents)} × {item.quantity}
              </p>
            ) : null}
          </div>
          {renderHeaderTrailing()}
        </div>
        {renderMultiQtySummary()}
      </button>
      <SpodeliDialog
        open={spodeliOpen}
        onOpenChange={setSpodeliOpen}
        item={item}
        participantId={participantId}
        participants={participants}
        sessionToken={sessionToken}
        itemAssignments={itemAssignments}
        participantLabels={participantLabels}
        readOnly={readOnly}
        onUnitToggled={onItemSelected}
      />
    </>
  )
}
