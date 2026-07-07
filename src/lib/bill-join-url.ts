export function buildBillJoinPath(billId: string): string {
  return `/bills/${billId}/join`
}

export function resolveAppOrigin(fallbackOrigin = ''): string {
  const fromEnv = import.meta.env.VITE_APP_ORIGIN?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, '')
  return ''
}

export function buildBillJoinUrl(billId: string, origin: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}${buildBillJoinPath(billId)}`
}
