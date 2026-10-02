export interface ExtractedItem {
  name: string
  unitPriceCents: number
  quantity: number
  confidence: 'high' | 'low'
}

export function sumItemsCents(items: ExtractedItem[]): number {
  return items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0)
}

export function detectTotalsMismatch(
  itemsTotalCents: number,
  receiptTotalCents: number | undefined,
): boolean {
  if (receiptTotalCents === undefined) return false
  return Math.abs(itemsTotalCents - receiptTotalCents) > 1
}
