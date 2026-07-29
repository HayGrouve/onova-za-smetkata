import { useState } from 'react'
import { useMutation } from 'convex/react'
import { PencilIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '#/lib/utils.ts'
import { ICON } from '#/lib/app-icons.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { HostUnitAssignmentDialog } from '#/components/bills/host-unit-assignment-dialog.tsx'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { Button } from '#/components/ui/button.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import {
  countCoveredUnits,
  isParticipantOnUnit,
} from '../../../shared/unit-coverage'

export interface AssignmentRowProps {
  itemId: Id<'items'>
  itemName: string
  itemQuantity: number
  itemUnitPriceCents: number
  participants: Doc<'participants'>[]
  labels: Record<string, string>
  itemAssignments: Doc<'itemAssignments'>[]
}

export function AssignmentRow({
  itemId,
  itemName,
  itemQuantity,
  itemUnitPriceCents,
  participants,
  labels,
  itemAssignments,
}: AssignmentRowProps) {
  const joinUnit = useMutation(api.assignments.joinUnit)
  const leaveUnit = useMutation(api.assignments.leaveUnit)
  const assignEven = useMutation(api.assignments.assignEven)
  const [editOpen, setEditOpen] = useState(false)

  const assignmentInputs = itemAssignments.map((assignment) => ({
    itemId: assignment.itemId,
    participantId: assignment.participantId,
    unitIndex: assignment.unitIndex,
  }))

  async function handleAssignEven() {
    try {
      await assignEven({ itemId })
      toast.success('Разпределено поравно между всички')
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handleToggle(participantId: Id<'participants'>) {
    const isAssigned = isParticipantOnUnit(
      itemId,
      0,
      participantId,
      assignmentInputs,
    )
    try {
      if (isAssigned) {
        await leaveUnit({ itemId, participantId, unitIndex: 0 })
      } else {
        await joinUnit({ itemId, participantId, unitIndex: 0 })
      }
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

  if (itemQuantity === 1) {
    const assignedCount = itemAssignments.length
    return (
      <div className="flex flex-col gap-2">
        {assignedCount > 1 ? (
          <Badge variant="secondary">Споделено ({assignedCount})</Badge>
        ) : null}
        <div className="flex flex-wrap gap-1.5">
          {participants.map((participant) => {
            const isAssigned = isParticipantOnUnit(
              itemId,
              0,
              participant._id,
              assignmentInputs,
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

  const coveredUnits = countCoveredUnits(
    { id: itemId, unitPriceCents: 0, quantity: itemQuantity },
    assignmentInputs,
  )

  return (
    <div className="flex flex-col gap-2">
      {coveredUnits > 0 ? (
        <p className="text-xs text-muted-foreground">
          {coveredUnits} от {itemQuantity} заети
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Редактирайте бройките или разделете поравно между всички участници.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-fit"
          onClick={() => setEditOpen(true)}
          data-testid={`host-unit-edit-${itemId}`}
        >
          <PencilIcon className={ICON.button} aria-hidden />
          Редактирай
        </Button>
        {renderAssignEvenButton(handleAssignEven)}
      </div>
      <HostUnitAssignmentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        item={{
          _id: itemId,
          name: itemName,
          quantity: itemQuantity,
          unitPriceCents: itemUnitPriceCents,
        }}
        participants={participants}
        itemAssignments={itemAssignments}
        participantLabels={labels}
      />
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
