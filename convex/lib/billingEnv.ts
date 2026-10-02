import { ConvexError } from 'convex/values'
import type { HostProInterval } from '../../shared/host-pro-plans'

/**
 * Host Pro billing switch (Convex env `BILLING_ENABLED=true`). Off: every Host
 * gets Pro limits for free and no checkout or paywall is shown.
 */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === 'true'
}

export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null
}

export interface StripeCheckoutConfig {
  secretKey: string
  priceIds: Record<HostProInterval, string>
  appOrigin: string
}

/** Everything checkout and the Customer Portal need; throws when billing is off. */
export function requireStripeCheckoutConfig(): StripeCheckoutConfig {
  if (!isBillingEnabled()) {
    throw new ConvexError({ code: 'BILLING_DISABLED' })
  }
  const secretKey = process.env.STRIPE_SECRET_KEY
  const month = process.env.STRIPE_PRICE_MONTHLY
  const year = process.env.STRIPE_PRICE_YEARLY
  const appOrigin = process.env.APP_ORIGIN
  if (!secretKey || !month || !year || !appOrigin) {
    throw new Error(
      'Stripe is not configured (STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY, APP_ORIGIN)',
    )
  }
  return {
    secretKey,
    priceIds: { month, year },
    appOrigin: appOrigin.replace(/\/+$/, ''),
  }
}

export function requireStripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured')
  return secretKey
}
