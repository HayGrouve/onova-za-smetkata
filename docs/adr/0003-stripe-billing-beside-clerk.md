# ADR 0003: Stripe Billing for Host Pro

**Status:** Accepted.

Host Pro is charged with **Stripe Billing** (EUR, Checkout + Customer Portal, SCA/3DS). **Clerk stays for Host auth only** — not Clerk Billing. Convex remains the quota source of truth (`hostTier`). We are the **seller** (not a merchant of record): VAT and invoices stay our obligation.

This supersedes the Billing half of [ADR 0002](./0002-clerk-auth-billing.md). Clerk for sign-in is unchanged.

Clerk Billing cannot prompt for 3DS and is USD-only, so Bulgarian/EU cards would fail. A merchant of record (Paddle, Polar) would take VAT off our plate but costs ~5%+50¢ on a €2.99 plan and Paddle needs sales contact under $10. Stripe wins on fees and EUR/3DS; we accept VAT work.

Do not enable Clerk Billing in the Dashboard. Do not treat leftover `/clerk/webhook` subscription events as the target architecture. New Host Pro work: Stripe Checkout/Portal + signed Stripe webhooks into Convex.
