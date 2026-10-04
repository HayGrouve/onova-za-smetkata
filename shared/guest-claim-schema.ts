import { deviceIdSchema } from './validation/fields'
import { SESSION_TOKEN_MAX, SESSION_TOKEN_MIN } from './validation/constants'

export type GuestClaimInput = {
  deviceId?: string
}

export function parseGuestClaimInput(
  input: GuestClaimInput,
): { ok: true; deviceId?: string } | { ok: false; message: string } {
  const parsed = deviceIdSchema.safeParse(input.deviceId)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Невалиден идентификатор',
    }
  }
  return { ok: true, deviceId: parsed.data }
}

export function buildClaimActorKey(
  sessionToken: string,
  deviceId?: string,
): string {
  if (deviceId) return `device:${deviceId}`
  return `token:${sessionToken.slice(0, 36)}`
}

/** A phone's session token: a client-made UUID, never empty or unbounded. */
export function isValidSessionToken(sessionToken: string): boolean {
  return (
    sessionToken.length >= SESSION_TOKEN_MIN &&
    sessionToken.length <= SESSION_TOKEN_MAX &&
    sessionToken.trim() === sessionToken
  )
}
