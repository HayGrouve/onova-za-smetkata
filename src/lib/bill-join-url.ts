export function buildBillJoinPath(billId: string, shareToken?: string): string {
  const base = `/bills/${billId}/join`
  if (!shareToken) return base
  return `${base}?t=${encodeURIComponent(shareToken)}`
}

export function resolveAppOrigin(fallbackOrigin = ''): string {
  const fromEnv = import.meta.env.VITE_APP_ORIGIN?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, '')
  return ''
}

export function buildBillJoinUrl(
  billId: string,
  origin: string,
  shareToken?: string,
): string {
  const base = origin.replace(/\/$/, '')
  return `${base}${buildBillJoinPath(billId, shareToken)}`
}
