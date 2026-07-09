import { deviceIdSchema } from './validation/fields'

export type GuestClaimInput = {
  deviceId?: string
}

export function parseGuestClaimInput(
  input: GuestClaimInput,
):
  | { ok: true; deviceId?: string }
  | { ok: false; message: string } {
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
