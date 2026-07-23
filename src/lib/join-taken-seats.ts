/** Participant ids taken by other active guest sessions (excludes the viewer's own seat). */
export function buildTakenParticipantIds(
  activeSessions: { participantId: string }[] | undefined,
  ownParticipantId: string | undefined,
): Set<string> {
  if (!activeSessions) return new Set<string>()
  return new Set(
    activeSessions
      .filter((session) => session.participantId !== ownParticipantId)
      .map((session) => session.participantId),
  )
}
