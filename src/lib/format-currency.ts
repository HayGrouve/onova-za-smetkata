const eurFormatter = new Intl.NumberFormat('bg-BG', {
  style: 'currency',
  currency: 'EUR',
})

export function formatEur(cents: number): string {
  return eurFormatter.format(cents / 100)
}

export function parseEurInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  if (Number.isNaN(parsed)) return 0
  return Math.round(parsed * 100)
}
