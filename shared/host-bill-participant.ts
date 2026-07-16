import { resolveHostParticipantName } from './host-profile'

export const HOST_PARTICIPANT_SORT_ORDER = 0

export type HostParticipantPlan = {
  name: string
  sortOrder: number
}

export type PlanHostParticipantOnBillCreateInput = {
  username?: string | null
  authName?: string | null
}

export function planHostParticipantOnBillCreate(
  input: PlanHostParticipantOnBillCreateInput,
): HostParticipantPlan {
  return {
    name: resolveHostParticipantName({
      username: input.username,
      authName: input.authName,
    }),
    sortOrder: HOST_PARTICIPANT_SORT_ORDER,
  }
}

/** Sort order for the next participant added after the host (and any existing seats). */
export function nextParticipantSortOrder(existingParticipantCount: number) {
  return existingParticipantCount
}

export function shouldClearHostParticipantId(
  removedParticipantId: string,
  hostParticipantId: string | undefined,
) {
  return (
    hostParticipantId !== undefined &&
    removedParticipantId === hostParticipantId
  )
}

export function isHostParticipant(
  participantId: string,
  hostParticipantId: string | undefined,
) {
  return (
    hostParticipantId !== undefined && participantId === hostParticipantId
  )
}
