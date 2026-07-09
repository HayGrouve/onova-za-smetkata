import { z } from 'zod'

const REVOLUT_USERNAME_PATTERN = /^[a-zA-Z0-9._-]{3,30}$/

export function normalizeRevolutUsername(input: string): string {
  return input.trim().replace(/^@+/, '')
}

export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, '').toUpperCase()
}

function letterToIbanDigits(char: string): string {
  return String(char.charCodeAt(0) - 55)
}

export function isValidIbanChecksum(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  const numeric = rearranged.replace(/[A-Z]/g, letterToIbanDigits)

  let remainder = 0
  for (let index = 0; index < numeric.length; index += 7) {
    remainder = Number(String(remainder) + numeric.slice(index, index + 7)) % 97
  }

  return remainder === 1
}

export function validateIban(
  input: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const normalized = normalizeIban(input)

  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(normalized)) {
    return { ok: false, message: 'Невалиден формат на IBAN' }
  }

  if (normalized.length < 15 || normalized.length > 34) {
    return { ok: false, message: 'Невалиден формат на IBAN' }
  }

  if (normalized.startsWith('BG')) {
    if (normalized.length !== 22) {
      return { ok: false, message: 'Невалиден български IBAN' }
    }
    if (!isValidIbanChecksum(normalized)) {
      return { ok: false, message: 'Невалиден български IBAN' }
    }
    return { ok: true, value: normalized }
  }

  return { ok: true, value: normalized }
}

export const paymentSettingsFormSchema = z
  .object({
    revolutUsername: z.string(),
    iban: z.string(),
  })
  .superRefine((values, context) => {
    const revolutRaw = values.revolutUsername.trim()
    if (revolutRaw) {
      const normalized = normalizeRevolutUsername(revolutRaw)
      if (!REVOLUT_USERNAME_PATTERN.test(normalized)) {
        context.addIssue({
          code: 'custom',
          path: ['revolutUsername'],
          message: 'Невалидно Revolut потребителско име',
        })
      }
    }

    const ibanRaw = values.iban.trim()
    if (ibanRaw) {
      const result = validateIban(ibanRaw)
      if (!result.ok) {
        context.addIssue({
          code: 'custom',
          path: ['iban'],
          message: result.message,
        })
      }
    }
  })
  .transform((values) => {
    const revolutRaw = values.revolutUsername.trim()
    const ibanRaw = values.iban.trim()

    return {
      revolutUsername: revolutRaw
        ? normalizeRevolutUsername(revolutRaw)
        : undefined,
      iban: ibanRaw ? normalizeIban(ibanRaw) : undefined,
    }
  })

export type PaymentSettingsFormInput = z.input<typeof paymentSettingsFormSchema>
export type PaymentSettingsSaveData = z.output<typeof paymentSettingsFormSchema>

export function parsePaymentSettingsInput(input: PaymentSettingsFormInput) {
  return paymentSettingsFormSchema.safeParse(input)
}

export function formatPaymentSettingsErrors(
  error: z.ZodError,
): { revolutUsername?: string; iban?: string } {
  const fieldErrors: { revolutUsername?: string; iban?: string } = {}

  for (const issue of error.issues) {
    const field = issue.path[0]
    if (field === 'revolutUsername' && !fieldErrors.revolutUsername) {
      fieldErrors.revolutUsername = issue.message
    }
    if (field === 'iban' && !fieldErrors.iban) {
      fieldErrors.iban = issue.message
    }
  }

  return fieldErrors
}
