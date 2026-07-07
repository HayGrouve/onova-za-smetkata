export function sumAssignedUnits(
  assignments: ReadonlyArray<{ units?: number }>,
): number {
  return assignments.reduce((sum, assignment) => sum + (assignment.units ?? 0), 0)
}

export function clampParticipantUnits(input: {
  itemQuantity: number
  requestedUnits: number
  existingAssignments: ReadonlyArray<{ participantId: string; units?: number }>
  participantId: string
}): number {
  const requested = Math.max(0, Math.round(input.requestedUnits))
  const otherTotal = input.existingAssignments
    .filter((assignment) => assignment.participantId !== input.participantId)
    .reduce((sum, assignment) => sum + (assignment.units ?? 0), 0)
  const available = Math.max(0, input.itemQuantity - otherTotal)
  return Math.min(requested, available, input.itemQuantity)
}
