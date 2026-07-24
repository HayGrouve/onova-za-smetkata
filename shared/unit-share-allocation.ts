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

export function sortAssigneesByParticipantOrder(
  assigneeIds: string[],
  participants: ParticipantOrder[],
): string[] {
  return [...new Set(assigneeIds)].sort((a, b) => {
    const orderA = participants.find((p) => p.id === a)?.sortOrder ?? 0
    const orderB = participants.find((p) => p.id === b)?.sortOrder ?? 0
    return orderA - orderB
  })
}

export function resolveEffectiveUnitAssignees(
  assigneeIds: string[],
  participantId: string,
  joining: boolean,
): string[] {
  const uniqueAssignees = [...new Set(assigneeIds)]
  if (joining && !uniqueAssignees.includes(participantId)) {
    return [...uniqueAssignees, participantId]
  }
  if (uniqueAssignees.length > 0) {
    return uniqueAssignees
  }
  return [participantId]
}

export function splitUnitShareAmongAssignees(
  unitPriceCents: number,
  assigneeIds: string[],
  participants: ParticipantOrder[],
): Array<{ id: string; cents: number }> {
  const sortedIds = sortAssigneesByParticipantOrder(assigneeIds, participants)
  return splitLineTotal(unitPriceCents, sortedIds)
}

export function unitShareCentsForParticipant(args: {
  unitPriceCents: number
  assigneeIds: string[]
  participants: ParticipantOrder[]
  participantId: string
  joining?: boolean
}): number {
  const effectiveAssignees = resolveEffectiveUnitAssignees(
    args.assigneeIds,
    args.participantId,
    args.joining ?? false,
  )
  const portions = splitUnitShareAmongAssignees(
    args.unitPriceCents,
    effectiveAssignees,
    args.participants,
  )
  return (
    portions.find((p) => p.id === args.participantId)?.cents ??
    args.unitPriceCents
  )
}
