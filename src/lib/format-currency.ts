const eurFormatter = new Intl.NumberFormat('bg-BG', {
  style: 'currency',
  currency: 'EUR',
})

export function formatEur(cents: number): string {
  return eurFormatter.format(cents / 100)
}
