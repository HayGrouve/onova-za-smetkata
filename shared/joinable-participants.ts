/** Participants guests may claim on the join screen — Host is omitted, not greyed. */
export function joinableParticipants<T extends { _id: string }>(
  participants: T[],
  hostParticipantId: string | undefined,
): T[] {
  if (!hostParticipantId) return participants
  return participants.filter((p) => p._id !== hostParticipantId)
}
