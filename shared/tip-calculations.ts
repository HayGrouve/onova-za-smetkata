import { lineTotalCents } from './bill-calculations'
import type { ItemInput } from './bill-calculations'
import { formatEurInput } from './validation/eur'

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

/** An amount field's value for `cents`; zero leaves the field empty. */
export function formatEurInputValue(cents: number): string {
  return cents === 0 ? '' : formatEurInput(cents)
}
