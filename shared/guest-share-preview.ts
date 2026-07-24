import type { ParticipantInput } from './bill-calculations'
import { unitShareCentsForParticipant } from './unit-share-allocation'

export function previewShareCents(
  unitPriceCents: number,
  assigneeIds: string[],
  participantId: string,
  joining: boolean,
  participants: ParticipantInput[],
): number {
  return unitShareCentsForParticipant({
    unitPriceCents,
    assigneeIds,
    participants,
    participantId,
    joining,
  })
}

export function formatShareParticipantCount(count: number): string {
  return count === 1 ? '1 човек' : `${count} души`
}
