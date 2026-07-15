export interface PaymentSettings {
  revolutUsername?: string
  iban?: string
}

export function isPaymentConfigured(
  settings: PaymentSettings | undefined,
): boolean {
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

function joinBulgarianNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} и ${names[1]}`
  return `${names.slice(0, -1).join(', ')} и ${names[names.length - 1]}`
}

/** Revolut transfer note: restaurant + "сметка за" + participant name(s). */
export function buildRevolutPaymentNote(
  restaurantName: string,
  participantNames: string[],
): string | undefined {
  const names = participantNames.map((name) => name.trim()).filter(Boolean)
  if (names.length === 0) return undefined
  const joinedNames = joinBulgarianNames(names)
  const restaurant = restaurantName.trim()
  if (restaurant) {
    return `${restaurant} сметка за ${joinedNames}`
  }
  return `сметка за ${joinedNames}`
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
