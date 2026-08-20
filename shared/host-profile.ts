import type { z } from 'zod'
import { personNameSchema } from './validation/fields'

export const HOST_PARTICIPANT_FALLBACK_NAME = 'домакин'

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

export function parseUsername(input: string) {
  const trimmed = input.trim()
  if (!trimmed) {
    return { success: true as const, data: undefined }
  }
  return personNameSchema.safeParse(trimmed)
}

export function formatUsernameError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Невалидно потребителско име'
}

export function resolveHostParticipantName(
  input: ResolveHostParticipantNameInput,
): string {
  const authName = input.authName?.trim()
  if (authName) return authName

  return HOST_PARTICIPANT_FALLBACK_NAME
}
