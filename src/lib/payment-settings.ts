import { joinLabels } from '#/lib/participant-labels.ts'

export interface PaymentSettings {
  revolutUsername?: string
  iban?: string
}

function isPaymentConfigured(settings: PaymentSettings | null): boolean {
  if (!settings) return false
  return Boolean(settings.revolutUsername?.trim() || settings.iban?.trim())
}

export type PaymentSettingsStatus = 'loading' | 'configured' | 'unconfigured'

export function getPaymentSettingsStatus(
  settings: PaymentSettings | null | undefined,
): PaymentSettingsStatus {
  if (settings === undefined) return 'loading'
  if (isPaymentConfigured(settings)) return 'configured'
  return 'unconfigured'
}

const LEGACY_STORAGE_KEY = 'onova-payment-settings'

export function loadLegacyPaymentSettings(): PaymentSettings {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PaymentSettings
  } catch {
    return {}
  }
}

export function clearLegacyPaymentSettings(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

/** Revolut caps the payment note at 64 characters. */
const REVOLUT_NOTE_MAX = 64

/** Revolut transfer note: restaurant + "сметка за" + participant name(s). */
export function buildRevolutPaymentNote(
  restaurantName: string,
  participantNames: string[],
): string | undefined {
  const names = participantNames.map((name) => name.trim()).filter(Boolean)
  if (names.length === 0) return undefined
  const joinedNames = joinLabels(names)
  const restaurant = restaurantName.trim()
  const note = restaurant
    ? `${restaurant} сметка за ${joinedNames}`
    : `сметка за ${joinedNames}`
  return note.length <= REVOLUT_NOTE_MAX
    ? note
    : `${note.slice(0, REVOLUT_NOTE_MAX - 1).trimEnd()}…`
}

export function buildRevolutUrl(
  username: string,
  remainingCents: number,
  note?: string,
): string {
  const clean = username.replace(/^@/, '').trim()
  const params = new URLSearchParams({
    amount: String(remainingCents),
    currency: 'EUR',
  })
  const trimmedNote = note?.trim()
  if (trimmedNote) {
    params.set('note', trimmedNote)
  }
  return `https://revolut.me/${encodeURIComponent(clean)}?${params.toString()}`
}
