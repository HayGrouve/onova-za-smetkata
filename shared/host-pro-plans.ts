/**
 * Host Pro plans as shown in the app. The charged amounts live on the Stripe
 * Prices (`STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY`, VAT-inclusive EUR);
 * keep these labels in step with them.
 */
export const HOST_PRO_INTERVALS = ['month', 'year'] as const

export type HostProInterval = (typeof HOST_PRO_INTERVALS)[number]

export interface HostProPlan {
  interval: HostProInterval
  label: string
  price: string
  period: string
  note?: string
}

export const HOST_PRO_PLANS: Record<HostProInterval, HostProPlan> = {
  month: {
    interval: 'month',
    label: 'Месечно',
    price: '€2.99',
    period: 'месец',
  },
  year: {
    interval: 'year',
    label: 'Годишно',
    price: '€29',
    period: 'година',
    note: 'Спестявате ~19%',
  },
}

/** What the Free tier allows (limits live in `convex/lib/hostTier.ts`). */
export const HOST_FREE_PLAN_SUMMARY =
  'До 5 сметки и 5 сканирания на бележки на месец и 1 група приятели. Pro маха лимитите.'

/**
 * Pre-checkout disclosures (ЗЗП / Directive 2011/83/EU). Draft wording —
 * confirm with a lawyer before turning billing on.
 */
export const HOST_PRO_DISCLOSURES = {
  pricing:
    'Цените са в евро и включват ДДС. Абонаментът се подновява автоматично в края на всеки период, докато не го откажете.',
  cancel:
    'Можете да откажете по всяко време от „Акаунт → Абонамент“; Pro остава активен до края на платения период.',
  seller:
    'Плащането се обработва от Stripe. Продавач на абонамента е Link (Sold through Link), който изпраща разписките и фактурите.',
  withdrawalConsent:
    'Искам Pro да започне веднага и разбирам, че така губя правото си на отказ в 14-дневен срок.',
} as const
