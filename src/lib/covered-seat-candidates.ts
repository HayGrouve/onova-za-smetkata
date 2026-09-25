import { joinableParticipants } from '../../shared/joinable-participants.ts'

export interface CoveredSeatCandidate {
  id: string
  label: string
  /** Why the seat cannot be picked, e.g. „Заето“ or „с Иван“. */
  unavailableLabel?: string
}

/** „Заето“ for someone's own seat, „с Иван“ for a seat Иван's phone covers. */
export function takenSeatLabel(
  heldBy: string | null,
  labels: Record<string, string>,
): string {
  return heldBy ? `с ${labels[heldBy] ?? 'друг'}` : 'Заето'
}

/** Other guest seats this phone could also claim and pay for. */
export function buildCoveredSeatCandidates(input: {
  participants: Array<{ _id: string; sortOrder: number }>
  hostParticipantId?: string
  ownParticipantId: string
  takenSeats: Map<string, string | null>
  labels: Record<string, string>
}): CoveredSeatCandidate[] {
  return joinableParticipants(input.participants, input.hostParticipantId)
    .filter((participant) => participant._id !== input.ownParticipantId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((participant) => {
      const label = input.labels[participant._id] ?? 'Участник'
      if (!input.takenSeats.has(participant._id)) {
        return { id: participant._id, label }
      }
      return {
        id: participant._id,
        label,
        unavailableLabel: takenSeatLabel(
          input.takenSeats.get(participant._id) ?? null,
          input.labels,
        ),
      }
    })
}
