import { z } from 'zod'
import { personNameSchema } from './validation/fields'

export const HOST_PARTICIPANT_FALLBACK_NAME = 'домакин'

export type ResolveHostParticipantNameInput = {
  username?: string | null
  authName?: string | null
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
  const username = input.username?.trim()
  if (username) return username

  const authName = input.authName?.trim()
  if (authName) return authName

  return HOST_PARTICIPANT_FALLBACK_NAME
}
