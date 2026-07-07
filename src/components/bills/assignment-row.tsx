import { useMutation } from 'convex/react'
import { cn } from '#/lib/utils.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface AssignmentRowProps {
  itemId: Id<'items'>
  participants: Doc<'participants'>[]
  labels: Record<string, string>
  assignedParticipantIds: Set<Id<'participants'>>
}

export function AssignmentRow({
  itemId,
  participants,
  labels,
  assignedParticipantIds,
}: AssignmentRowProps) {
  const toggleAssignment = useMutation(api.assignments.toggle)

  if (participants.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Добавете участници, за да разпределите артикула.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {participants.map((participant) => {
        const isAssigned = assignedParticipantIds.has(participant._id)
        return (
          <button
            key={participant._id}
            type="button"
            onClick={() =>
              void toggleAssignment({ itemId, participantId: participant._id })
            }
            className={cn(
              'flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors',
              isAssigned
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-transparent text-muted-foreground',
            )}
          >
            {labels[participant._id] ?? participant.name}
          </button>
        )
      })}
    </div>
  )
}
