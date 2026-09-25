export interface ParticipantOrder {
  id: string
  sortOrder: number
}

export function splitLineTotal(
  totalCents: number,
  participantIds: string[],
): Array<{ id: string; cents: number }> {
  if (participantIds.length === 0) return []
  const base = Math.floor(totalCents / participantIds.length)
  const remainder = totalCents % participantIds.length
  return participantIds.map((id, index) => ({
    id,
    cents: base + (index < remainder ? 1 : 0),
  }))
}

function sortAssigneesByParticipantOrder(
  assigneeIds: string[],
  participants: ParticipantOrder[],
): string[] {
  return [...new Set(assigneeIds)].sort((a, b) => {
    const orderA = participants.find((p) => p.id === a)?.sortOrder ?? 0
    const orderB = participants.find((p) => p.id === b)?.sortOrder ?? 0
    return orderA - orderB
  })
}

export function splitUnitShareAmongAssignees(
  unitPriceCents: number,
  assigneeIds: string[],
  participants: ParticipantOrder[],
): Array<{ id: string; cents: number }> {
  const sortedIds = sortAssigneesByParticipantOrder(assigneeIds, participants)
  return splitLineTotal(unitPriceCents, sortedIds)
}
