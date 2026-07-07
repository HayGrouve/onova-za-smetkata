const STORAGE_KEY = 'onova-payment-settings'

export interface PaymentSettings {
  revolutUsername?: string
  iban?: string
}

export function loadPaymentSettings(): PaymentSettings {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PaymentSettings
  } catch {
    return {}
  }
}

export function savePaymentSettings(settings: PaymentSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function buildRevolutUrl(username: string, remainingCents: number): string {
  const clean = username.replace(/^@/, '').trim()
  const amount = (remainingCents / 100).toFixed(2)
  return `https://revolut.me/${encodeURIComponent(clean)}/${amount}`
}
