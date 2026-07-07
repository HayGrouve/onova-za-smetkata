export interface PaymentSettings {
  revolutUsername?: string
  iban?: string
}

export function isPaymentConfigured(settings: PaymentSettings | undefined): boolean {
  if (!settings) return false
  return Boolean(settings.revolutUsername?.trim() || settings.iban?.trim())
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

export function buildRevolutUrl(username: string, remainingCents: number): string {
  const clean = username.replace(/^@/, '').trim()
  const amount = (remainingCents / 100).toFixed(2)
  return `https://revolut.me/${encodeURIComponent(clean)}/${amount}`
}
