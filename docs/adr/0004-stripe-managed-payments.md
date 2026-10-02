# ADR 0004: Stripe Managed Payments for Host Pro, behind a billing switch

**Status:** Accepted. Supersedes the "we are the seller" half of [ADR 0003](./0003-stripe-billing-beside-clerk.md); Stripe Checkout, the Customer Portal and Convex as the quota source of truth are unchanged.

## Context

Host Pro is €2.99/month or €29/year. The owner sells as a Bulgarian freelancer, not a company. Selling directly to consumers would make us liable for consumer VAT (OSS above €10k cross-border), Наредба Н-18 fiscal documents for card payments, and invoicing. Stripe Managed Payments makes Stripe's Link ("Sold through Link") the merchant of record: it collects and remits VAT, sends receipts and invoices, handles cooling-off refunds and dispute evidence. It costs 3.5% on top of standard Stripe fees, which at €2.99 is the cheapest merchant of record we found (Paddle, Polar, Creem and Lemon Squeezy charge $0.40–0.50 fixed).

Billing is not live yet: Managed Payments needs Stripe's eligibility review, and the tax and social-security setup is being sorted out. Until then the app must be free.

## Decision

- **Billing switch.** Convex env `BILLING_ENABLED=true` turns Host Pro on. Off (the default): `getEntitledTier` treats every Host as Pro, no quota error is thrown, and no paywall, plan picker or „Абонамент“ page is rendered.
- **Checkout.** `billingStripe.createCheckoutSession` creates a subscription-mode Checkout Session with `managed_payments.enabled`, the Host's own Stripe customer, `client_reference_id` = Convex user id, and Bulgarian locale. Prices are VAT-inclusive EUR (`STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`) on a product with an eligible SaaS tax code. The Host must tick the 14-day withdrawal waiver first; its time is stored on the subscription metadata.
- **Sync, not event replay.** `POST /stripe/webhook` (`convex/http.ts`) verifies `Stripe-Signature` with Web Crypto (5-minute tolerance), records the event id once in `processedWebhookEvents`, and schedules `billingStripe.syncCustomer`, which lists the customer's subscriptions from Stripe and writes the `users` mirror. Ordering and retries therefore cannot leave stale state; `billingSyncedAt` drops syncs fetched before the stored one. The return from Checkout also syncs (`syncAfterCheckout`) so Pro does not wait for the webhook.
- **Entitlement.** `users.subscriptionStatus` stores Stripe's status as-is. `getEffectiveTier` grants Pro for `active`/`trialing`, for `past_due` during a 7-day grace from the first failure, and never after a subscription ended (its end time is stored as `currentPeriodEnd`).
- **Self-service.** The Stripe Customer Portal (cancel, change monthly↔annual, card, invoices) opens from „Акаунт → Абонамент“, a Clerk `UserProfile` custom page. Link also lets customers manage orders at link.com.

## Consequences

- New Convex env: `BILLING_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `APP_ORIGIN` ([DEPLOY.md](../DEPLOY.md)).
- `users.plan` is `'pro'` once a Stripe subscription exists, else `'free'`. It replaced the Clerk Billing-era `clerkPlanSlug`, which `backfill:planFromClerkPlanSlug` moves over once per environment.
- Managed Payments cannot be enabled on existing subscriptions; switching to direct Stripe billing later only affects new subscriptions.
- Customers see "Sold through Link" and `LINK.COM*` on statements; custom checkout domains are not supported.
- Tests cover the signature check against Stripe's own signer, webhook dedupe, the subscription → tier mapping and the switch. The Stripe API calls themselves are verified in Stripe test mode, not in Vitest.
