import { useMutation } from 'convex/react'
import { MinusIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '#/lib/utils.ts'
import { ICON } from '#/lib/app-icons.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button.tsx'

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
  const assignEven = useMutation(api.assignments.assignEven)

  async function handleAssignEven() {
    try {
      await assignEven({ itemId })
      toast.success('Разпределено поравно между всички')
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handleToggle(participantId: Id<'participants'>) {
    try {
      await toggleAssignment({ itemId, participantId })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handleSetUnits(
    participantId: Id<'participants'>,
    units: number,
  ) {
    try {
      await setUnits({ itemId, participantId, units })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

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
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-1.5">
          {participants.map((participant) => {
            const isAssigned = itemAssignments.some(
              (assignment) => assignment.participantId === participant._id,
            )
            return (
              <button
                key={participant._id}
                type="button"
                aria-pressed={isAssigned}
                onClick={() => void handleToggle(participant._id)}
                className={chipClassName(isAssigned)}
              >
                {labels[participant._id] ?? participant.name}
              </button>
            )
          })}
        </div>
        {renderAssignEvenButton(handleAssignEven)}
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
                aria-pressed={false}
                onClick={() => void handleToggle(participant._id)}
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
                'flex min-h-11 items-center gap-0.5 rounded-full border border-primary/50 bg-primary/15 pl-1 pr-1 text-foreground dark:border-primary/40 dark:bg-primary/20',
              )}
            >
              <button
                type="button"
                aria-label={`Намали ${label}`}
                onClick={() => void handleSetUnits(participant._id, units - 1)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-foreground/10"
              >
                <MinusIcon className="size-3.5" />
              </button>
              <span className="min-w-12 px-1.5 text-center text-xs font-medium">
                {label} ×{units}
              </span>
              <button
                type="button"
                aria-label={`Увеличи ${label}`}
                onClick={() => void handleSetUnits(participant._id, units + 1)}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-foreground/10"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
      {unitsMismatch && (
        <p className="text-xs font-medium text-accent-foreground">
          Разпределени {assignedUnitsTotal} от {itemQuantity} броя
        </p>
      )}
      {renderAssignEvenButton(handleAssignEven)}
    </div>
  )
}

function renderAssignEvenButton(onClick: () => void) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-fit"
      onClick={() => void onClick()}
    >
      <UsersIcon className={ICON.button} aria-hidden />
      Раздели поравно
    </Button>
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
