import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { cn } from '#/lib/utils.ts'
import { formatEur } from '#/lib/format-currency.ts'
import {
  formatSpodeliUnitTitle,
  getAssigneeIdsOnUnit,
  getOtherClaimantLabelsForUnit,
  isParticipantOnUnit,
} from '#/lib/guest-claim-items.ts'
import {
  formatShareParticipantCount,
  previewShareCents,
} from '#/lib/guest-share-preview.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'

export interface SpodeliDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Doc<'items'>
  participantId: Id<'participants'>
  sessionToken?: string
  itemAssignments: Doc<'itemAssignments'>[]
  participantLabels: Record<string, string>
  readOnly: boolean
  onUnitToggled?: () => void
}

export function SpodeliDialog({
  open,
  onOpenChange,
  item,
  participantId,
  sessionToken,
  itemAssignments,
  participantLabels,
  readOnly,
  onUnitToggled,
}: SpodeliDialogProps) {
  const joinUnit = useMutation(api.assignments.joinUnit)
  const leaveUnit = useMutation(api.assignments.leaveUnit)

  async function handleUnitToggle(unitIndex: number) {
    if (readOnly) return
    const joined = isParticipantOnUnit(
      itemAssignments,
      unitIndex,
      participantId,
    )
    try {
      if (joined) {
        await leaveUnit({
          itemId: item._id,
          participantId,
          unitIndex,
          sessionToken,
        })
      } else {
        await joinUnit({
          itemId: item._id,
          participantId,
          unitIndex,
          sessionToken,
        })
      }
      onUnitToggled?.()
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,32rem)] overflow-y-auto sm:max-w-md"
        data-testid="spodeli-dialog"
      >
        <DialogHeader>
          <DialogTitle>Сподели · {item.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {Array.from({ length: item.quantity }, (_, unitIndex) => (
            <SpodeliUnitCard
              key={unitIndex}
              item={item}
              unitIndex={unitIndex}
              itemAssignments={itemAssignments}
              participantId={participantId}
              participantLabels={participantLabels}
              readOnly={readOnly}
              onToggle={() => void handleUnitToggle(unitIndex)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface SpodeliUnitCardProps {
  item: Doc<'items'>
  unitIndex: number
  itemAssignments: Doc<'itemAssignments'>[]
  participantId: Id<'participants'>
  participantLabels: Record<string, string>
  readOnly: boolean
  onToggle: () => void
}

function SpodeliUnitCard({
  item,
  unitIndex,
  itemAssignments,
  participantId,
  participantLabels,
  readOnly,
  onToggle,
}: SpodeliUnitCardProps) {
  const joined = isParticipantOnUnit(itemAssignments, unitIndex, participantId)
  const assigneeIds = getAssigneeIdsOnUnit(itemAssignments, unitIndex)
  const otherClaimants = getOtherClaimantLabelsForUnit(
    itemAssignments,
    unitIndex,
    participantId,
    participantLabels,
  )
  const isEmpty = assigneeIds.length === 0
  const shareCents = previewShareCents(
    item.unitPriceCents,
    assigneeIds,
    participantId,
    !joined,
  )

  const cardClassName = cn(
    'guest-claim-card flex flex-col gap-1 rounded-lg border p-4 text-left',
    'border-border bg-card',
    !readOnly && 'tap-feedback',
    readOnly && 'opacity-80',
    joined &&
      'guest-claim-card--selected border-primary/50 bg-primary/10 dark:border-primary/40 dark:bg-primary/15',
  )

  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={onToggle}
      className={cardClassName}
      data-testid={`spodeli-unit-${unitIndex + 1}`}
      aria-label={`${formatSpodeliUnitTitle(item.name, unitIndex)}, ${joined ? 'ваше' : 'докоснете за отбелязване'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">
          {formatSpodeliUnitTitle(item.name, unitIndex)}
        </p>
        <p className="money shrink-0 text-sm font-medium">
          {formatEur(item.unitPriceCents)}
        </p>
      </div>
      {joined ? (
        <>
          <p className="text-xs font-medium text-primary">✓ Ваше</p>
          {otherClaimants.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Споделено с {otherClaimants.join(', ')} (
              {formatShareParticipantCount(otherClaimants.length)})
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Вашият дял: {formatEur(shareCents)}
          </p>
          {!readOnly ? (
            <p className="text-xs font-medium text-muted-foreground">
              Докоснете, за да излезете
            </p>
          ) : null}
        </>
      ) : (
        <>
          {isEmpty ? (
            <p className="text-xs text-muted-foreground">Празна бройка</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Споделено с {otherClaimants.join(', ')} (
                {formatShareParticipantCount(otherClaimants.length)})
              </p>
              <p className="text-xs text-muted-foreground">
                Вашият дял: {formatEur(shareCents)}
              </p>
            </>
          )}
          {!readOnly ? (
            <p className="text-xs font-medium text-muted-foreground">
              Присъедини се
            </p>
          ) : null}
        </>
      )}
    </button>
  )
}
