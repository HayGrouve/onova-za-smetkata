export const TIP_PREFERENCE_KEY = 'tip-preference'

export type TipPercent = 0 | 10 | 15 | 20

export type TipPreference =
  | { mode: 'percent'; percent: TipPercent }
  | { mode: 'custom'; customCents: number }

const TIP_PERCENTS = new Set<TipPercent>([0, 10, 15, 20])

function isTipPercent(value: unknown): value is TipPercent {
  return typeof value === 'number' && TIP_PERCENTS.has(value as TipPercent)
}

function parseTipPreference(raw: unknown): TipPreference | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (record.mode === 'percent' && isTipPercent(record.percent)) {
    return { mode: 'percent', percent: record.percent }
  }
  if (
    record.mode === 'custom' &&
    typeof record.customCents === 'number' &&
    Number.isInteger(record.customCents) &&
    record.customCents >= 0
  ) {
    return { mode: 'custom', customCents: record.customCents }
  }
  return null
}

export function readTipPreference(): TipPreference | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(TIP_PREFERENCE_KEY)
  if (!raw) return null
  try {
    return parseTipPreference(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeTipPreference(pref: TipPreference): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(TIP_PREFERENCE_KEY, JSON.stringify(pref))
}
