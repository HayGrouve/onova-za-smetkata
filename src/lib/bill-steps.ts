/**
 * Host editor steps behind the `?step=` search param. The receipt shows them
 * as three phases (`phaseForStep`); onboarding guidance still counts steps.
 */
export type BillStep = 1 | 2 | 3 | 4

/** How guidance names each step ("Напред: Хората"). */
export const BILL_STEP_LABELS = [
  'Бележката',
  'Хората',
  'На масата',
  'Разплащане',
] as const
