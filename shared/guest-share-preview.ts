import { splitLineTotal } from './bill-calculations'

export function previewShareCents(
  lineTotalCents: number,
  assigneeIds: string[],
  participantId: string,
  joining: boolean,
): number {
  const uniqueAssignees = [...new Set(assigneeIds)]
  const idsForSplit =
    joining && !uniqueAssignees.includes(participantId)
      ? [...uniqueAssignees, participantId]
      : uniqueAssignees.length > 0
        ? uniqueAssignees
        : [participantId]

  const sortedIds = [...new Set(idsForSplit)].sort()
  const portions = splitLineTotal(lineTotalCents, sortedIds)
  return portions.find((p) => p.id === participantId)?.cents ?? lineTotalCents
}

export function formatShareParticipantCount(count: number): string {
  return count === 1 ? '1 човек' : `${count} души`
}
