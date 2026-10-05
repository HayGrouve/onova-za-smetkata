import { PERSON_NAME_MAX } from './validation/constants'

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
  // The Auth name comes from Clerk unchecked; give the seat the same bounds
  // as any participant name (no control characters, PERSON_NAME_MAX long).
  const authName = Array.from(
    // eslint-disable-next-line no-control-regex -- strip control characters
    (input.authName ?? '').replace(/[\x00-\x1f\x7f-\x9f]/g, '').trim(),
  )
    .slice(0, PERSON_NAME_MAX)
    .join('')
    .trim()
  if (authName) return authName

  return HOST_PARTICIPANT_FALLBACK_NAME
}
