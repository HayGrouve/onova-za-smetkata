import { z } from 'zod'
import { BILL_PARTICIPANTS_MAX } from './validation/constants'
import { personNameSchema } from './validation/fields'

export type ParticipantAddInput = { name: string }

export type ParticipantAddContext = {
  existingNames: string[]
  participantCount: number
}

const DUPLICATE_MESSAGE = 'Този участник вече е на сметката'
const CAP_MESSAGE = `Максимум ${BILL_PARTICIPANTS_MAX} участника на сметка`

export function participantNameKey(name: string): string {
  return name.trim().toLowerCase()
}

export function parseParticipantName(name: string) {
  return personNameSchema.safeParse(name)
}

export function formatParticipantNameError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Невалидно име'
}

export function validateParticipantAdd(
  input: ParticipantAddInput,
  context: ParticipantAddContext,
): { ok: true; name: string } | { ok: false; message: string; field?: 'name' } {
  const parsed = parseParticipantName(input.name)
  if (!parsed.success) {
    return {
      ok: false,
      message: formatParticipantNameError(parsed.error),
      field: 'name',
    }
  }

  const trimmedName = parsed.data
  const key = participantNameKey(trimmedName)
  const existingKeys = new Set(
    context.existingNames.map((existing) => participantNameKey(existing)),
  )

  if (existingKeys.has(key)) {
    return { ok: false, message: DUPLICATE_MESSAGE, field: 'name' }
  }

  if (context.participantCount >= BILL_PARTICIPANTS_MAX) {
    return { ok: false, message: CAP_MESSAGE, field: 'name' }
  }

  return { ok: true, name: trimmedName }
}
