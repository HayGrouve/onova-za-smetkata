import { GUEST_FLOW_MESSAGES } from './guest-flow-messages'

export type CoveredSeatSelectionResult =
  { ok: true; coveredParticipantIds: string[] } | { ok: false; message: string }

/**
 * Covered seats a guest session may hold besides its own seat: on the bill,
 * not the Host, not the own seat, and not held by another active session.
 */
export function validateCoveredSeatSelection(input: {
  ownParticipantId: string
  coveredParticipantIds: string[]
  billParticipantIds: string[]
  hostParticipantId?: string
  takenByOtherSessions: Set<string>
}): CoveredSeatSelectionResult {
  const onBill = new Set(input.billParticipantIds)
  const covered = [...new Set(input.coveredParticipantIds)]

  for (const participantId of covered) {
    if (participantId === input.ownParticipantId) {
      return { ok: false, message: GUEST_FLOW_MESSAGES.coveredSeatIsOwn }
    }
    if (!onBill.has(participantId)) {
      return { ok: false, message: GUEST_FLOW_MESSAGES.participantNotOnBill }
    }
    if (participantId === input.hostParticipantId) {
      return { ok: false, message: GUEST_FLOW_MESSAGES.coveredSeatIsHost }
    }
    if (input.takenByOtherSessions.has(participantId)) {
      return { ok: false, message: GUEST_FLOW_MESSAGES.coveredSeatTaken }
    }
  }

  return { ok: true, coveredParticipantIds: covered }
}

/** Every seat a guest session handles: own seat first, then Covered seats. */
export function sessionSeatIds(session: {
  participantId: string
  coveredParticipantIds?: string[]
}): string[] {
  return [
    session.participantId,
    ...(session.coveredParticipantIds ?? []).filter(
      (id) => id !== session.participantId,
    ),
  ]
}
