import { lineTotalCents, type ItemInput } from './bill-calculations'

export type TipPercent = 0 | 10 | 15 | 20

export type TipPreference =
  | { mode: 'percent'; percent: TipPercent }
  | { mode: 'custom'; customCents: number }

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

export function resolveInitialTipCents(
  pref: TipPreference | null,
  itemsSubtotalCents: number,
): number {
  if (!pref) return 0
  if (pref.mode === 'percent') {
    return tipCentsFromPercent(itemsSubtotalCents, pref.percent)
  }
  return pref.customCents
}
