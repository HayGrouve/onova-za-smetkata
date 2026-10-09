import { PERSON_NAME_MAX } from './validation/constants'
import { hasVisibleText } from './validation/visible-text'

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
  // eslint-disable-next-line no-control-regex -- strip control characters
  const cleaned = (input.authName ?? '').replace(/[\x00-\x1f\x7f-\x9f]/g, '')
  let authName = ''
  for (const char of cleaned.trim()) {
    // UTF-16 length, as the name schema counts it; never split a character.
    if (authName.length + char.length > PERSON_NAME_MAX) break
    authName += char
  }
  authName = authName.trim()
  if (hasVisibleText(authName)) return authName

  return HOST_PARTICIPANT_FALLBACK_NAME
}
