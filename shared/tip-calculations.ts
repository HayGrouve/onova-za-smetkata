import { lineTotalCents } from './bill-calculations'
import type { ItemInput } from './bill-calculations'

export type TipPercent = 0 | 10 | 15 | 20

export const TIP_PRESETS: readonly TipPercent[] = [0, 10, 15, 20]

export function tipCentsFromPercent(
  itemsSubtotalCents: number,
  percent: TipPercent,
): number {
  if (itemsSubtotalCents <= 0) return 0
  return Math.round((itemsSubtotalCents * percent) / 100)
}

export function calculateItemsSubtotalCents(items: ItemInput[]): number {
  return items.reduce((sum, item) => sum + lineTotalCents(item), 0)
}

export function formatEurInputValue(cents: number): string {
  if (cents === 0) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}
