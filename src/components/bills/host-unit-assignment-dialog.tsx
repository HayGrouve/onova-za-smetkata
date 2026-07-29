import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { cn } from '#/lib/utils.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { UnitLineSummary } from '#/components/bills/unit-line-summary.tsx'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import {
  formatUnitTitle,
  isParticipantOnUnit,
  participantIdsOnUnit,
} from '../../../shared/unit-coverage'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'

export interface HostUnitAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Pick<Doc<'items'>, '_id' | 'name' | 'quantity' | 'unitPriceCents'>
  participants: Doc<'participants'>[]
  itemAssignments: Doc<'itemAssignments'>[]
  participantLabels: Record<string, string>
}

export function HostUnitAssignmentDialog({
  open,
  onOpenChange,
  item,
  participants,
  itemAssignments,
  participantLabels,
}: HostUnitAssignmentDialogProps) {
  const joinUnit = useMutation(api.assignments.joinUnit)
  const leaveUnit = useMutation(api.assignments.leaveUnit)

  const assignmentInputs = itemAssignments.map((assignment) => ({
    itemId: assignment.itemId,
    participantId: assignment.participantId,
    unitIndex: assignment.unitIndex,
  }))

  async function handleChipToggle(
    participantId: Id<'participants'>,
    unitIndex: number,
  ) {
    const assigned = isParticipantOnUnit(
      item._id,
      unitIndex,
      participantId,
      assignmentInputs,
    )
    try {
      if (assigned) {
        await leaveUnit({ itemId: item._id, participantId, unitIndex })
      } else {
        await joinUnit({ itemId: item._id, participantId, unitIndex })
      }
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[min(90vh,32rem)] overflow-y-auto sm:max-w-md"
        data-testid="host-unit-assignment-dialog"
      >
        <DialogHeader>
          <DialogTitle>Разпределяне · {item.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {Array.from({ length: item.quantity }, (_, unitIndex) => {
            const assigneeIds = participantIdsOnUnit(
              item._id,
              unitIndex,
              assignmentInputs,
            )
            const assigneeLabels = assigneeIds.map(
              (id) => participantLabels[id] ?? id,
            )

            return (
              <div
                key={unitIndex}
                className="rounded-lg border border-border bg-card p-4"
                data-testid={`host-unit-${unitIndex + 1}`}
              >
                <UnitLineSummary
                  unitTitle={formatUnitTitle(item.name, unitIndex)}
                  unitPriceCents={item.unitPriceCents}
                  isEmpty={assigneeIds.length === 0}
                  otherClaimantLabels={assigneeLabels}
                  showSharePreview={false}
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {participants.map((participant) => {
                    const isAssigned = isParticipantOnUnit(
                      item._id,
                      unitIndex,
                      participant._id,
                      assignmentInputs,
                    )
                    return (
                      <button
                        key={participant._id}
                        type="button"
                        aria-pressed={isAssigned}
                        onClick={() =>
                          void handleChipToggle(participant._id, unitIndex)
                        }
                        className={chipClassName(isAssigned)}
                      >
                        {participantLabels[participant._id] ?? participant.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function chipClassName(isAssigned: boolean) {
  return cn(
    'flex min-h-11 items-center rounded-full border px-3.5 text-xs font-medium transition-colors',
    isAssigned
      ? 'border-primary/50 bg-primary/15 text-foreground dark:border-primary/40 dark:bg-primary/20'
      : 'border-input bg-background/60 text-muted-foreground hover:bg-accent/50',
  )
}
