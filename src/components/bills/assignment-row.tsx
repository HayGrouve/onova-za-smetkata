import { useMutation } from 'convex/react'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface AssignmentRowProps {
  itemId: Id<'items'>
  itemQuantity: number
  participants: Doc<'participants'>[]
  labels: Record<string, string>
  itemAssignments: Doc<'itemAssignments'>[]
}

export function AssignmentRow({
  itemId,
  itemQuantity,
  participants,
  labels,
  itemAssignments,
}: AssignmentRowProps) {
  const toggleAssignment = useMutation(api.assignments.toggle)
  const setUnits = useMutation(api.assignments.setUnits)

  if (participants.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Добавете участници, за да разпределите артикула.
      </p>
    )
  }

  const unitsByParticipant = new Map(
    itemAssignments.map((assignment) => [
      assignment.participantId,
      assignment.units ?? 0,
    ]),
  )
  const assignedUnitsTotal = itemAssignments.reduce(
    (sum, assignment) => sum + (assignment.units ?? 0),
    0,
  )
  const unitsMismatch =
    itemQuantity > 1 &&
    itemAssignments.length > 0 &&
    assignedUnitsTotal !== itemQuantity

  if (itemQuantity === 1) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {participants.map((participant) => {
          const isAssigned = itemAssignments.some(
            (assignment) => assignment.participantId === participant._id,
          )
          return (
            <button
              key={participant._id}
              type="button"
              onClick={() =>
                void toggleAssignment({ itemId, participantId: participant._id })
              }
              className={chipClassName(isAssigned)}
            >
              {labels[participant._id] ?? participant.name}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {participants.map((participant) => {
          const units = unitsByParticipant.get(participant._id) ?? 0
          const isAssigned = units > 0
          const label = labels[participant._id] ?? participant.name

          if (!isAssigned) {
            return (
              <button
                key={participant._id}
                type="button"
                onClick={() =>
                  void toggleAssignment({ itemId, participantId: participant._id })
                }
                className={chipClassName(false)}
              >
                {label}
              </button>
            )
          }

          return (
            <div
              key={participant._id}
              className={cn(
                'flex h-8 items-center gap-0.5 rounded-full border border-primary/50 bg-primary/15 pl-1 pr-1 text-foreground dark:border-primary/40 dark:bg-primary/20',
              )}
            >
              <button
                type="button"
                aria-label={`Намали ${label}`}
                onClick={() =>
                  void setUnits({
                    itemId,
                    participantId: participant._id,
                    units: units - 1,
                  })
                }
                className="flex size-6 items-center justify-center rounded-full hover:bg-foreground/10"
              >
                <MinusIcon className="size-3.5" />
              </button>
              <span className="min-w-12 px-1.5 text-center text-xs font-medium">
                {label} ×{units}
              </span>
              <button
                type="button"
                aria-label={`Увеличи ${label}`}
                onClick={() =>
                  void setUnits({
                    itemId,
                    participantId: participant._id,
                    units: units + 1,
                  })
                }
                className="flex size-6 items-center justify-center rounded-full hover:bg-foreground/10"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
      {unitsMismatch && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          Разпределени {assignedUnitsTotal} от {itemQuantity} броя
        </p>
      )}
    </div>
  )
}

function chipClassName(isAssigned: boolean) {
  return cn(
    'flex h-8 items-center rounded-full border px-3.5 text-xs font-medium transition-colors',
    isAssigned
      ? 'border-primary/50 bg-primary/15 text-foreground dark:border-primary/40 dark:bg-primary/20'
      : 'border-input bg-background/60 text-muted-foreground hover:bg-accent/50',
  )
}
