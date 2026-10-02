const HOST_PARTICIPANT_FALLBACK_NAME = 'домакин'

export type ResolveHostParticipantNameInput = {
  authName?: string | null
}

/** Clerk Auth name to persist on `users.name`. Undefined means leave the stored value. */
export function nextSyncedAuthName(
  storedName: string | null | undefined,
  identityName: string | null | undefined,
): string | undefined {
  const next = identityName?.trim()
  if (!next) return undefined
  if (storedName?.trim() === next) return undefined
  return next
}

export function resolveHostParticipantName(
  input: ResolveHostParticipantNameInput,
): string {
  const authName = input.authName?.trim()
  if (authName) return authName

  return HOST_PARTICIPANT_FALLBACK_NAME
}
