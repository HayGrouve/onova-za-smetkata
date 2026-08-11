# Research: Clerk Billing platform constraints

Part of wayfinder map [#114](https://github.com/HayGrouve/onova-za-smetkata/issues/114). Resolves [#115](https://github.com/HayGrouve/onova-za-smetkata/issues/115).

## Question

What hard constraints does [Clerk Billing](https://clerk.com/docs/guides/billing/overview) impose that affect compliance — USD-only currency, no 3DS, no VAT, restricted countries, separate dev/prod Stripe, refunds — and how do they interact with locked €2.99/mo EUR pricing (#111) and Bulgarian/EU hosts?

## Executive summary

| Constraint               | Clerk fact                                                                                      | Impact on this project                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Currency**             | USD only ([FAQ](https://clerk.com/docs/guides/billing/overview))                                | Conflicts with €2.99 EUR product copy and dashboard docs |
| **3DS / SCA**            | Not supported; background renewals fail ([FAQ](https://clerk.com/docs/guides/billing/overview)) | High risk for EU/BG card payments and recurring charges  |
| **VAT / tax**            | Not supported (planned)                                                                         | EU B2C obligation remains on us; not MoR                 |
| **Restricted countries** | BR, IN, MY, MX, SG, TH only                                                                     | Bulgaria OK via Stripe                                   |
| **Stripe accounts**      | Dev sandbox ≠ prod; separate accounts required                                                  | Documented in `docs/clerk-production-setup.md`           |
| **Refunds**              | Manual via Stripe; not reflected in Clerk MRR                                                   | Operational gap for EU consumers                         |
| **Metered quotas**       | Boolean plan/feature gates only                                                                 | Convex enforcement (correct per #104)                    |

## Dashboard setup (B2C)

1. Enable Billing → Plans for Users (`npx clerk@latest enable billing --for users`)
2. Dev: Clerk shared test gateway; prod: connect own Stripe account
3. Plans: `free_user` (default) + `pro` — **price must be USD in Clerk**
4. Optional features: `ocr`, `friend_groups` (UX gates; Convex enforces quotas)
5. Webhook → Convex `/clerk/webhook`; subscribe to billing lifecycle events

## SDK patterns required

- `<PricingTable />`, `<SubscriptionDetailsButton />`, `clerk.billing.startCheckout()`
- `<Show when={{ plan \| feature }}>` / `has()` for UX gates (Convex mutations authoritative)
- Session reload after checkout before `has()` reflects Pro

## Webhook events (full catalog vs project subset)

Project subscribes: `subscriptionItem.active`, `.canceled`, `.pastDue`, `subscription.updated`.

Recommended additions: `subscriptionItem.updated` (renewals), `subscriptionItem.ended` (final downgrade), optional `paymentAttempt.updated` (recurring failures / 3DS).

## Conflicts with locked decisions

| Project (#111, spec)      | Clerk reality                                        | Severity                     |
| ------------------------- | ---------------------------------------------------- | ---------------------------- |
| €2.99/mo EUR              | USD-only billing                                     | **Blocker — needs #118**     |
| Paywall copy „€2.99/мес.“ | Actual charge USD + FX                               | Legal/UX mismatch            |
| 7-day grace on `past_due` | OK if webhooks fire; 3DS may block checkout/renewals | Elevated EU risk             |
| No VAT in spec            | Clerk has no VAT                                     | Compliance gap outside Clerk |

## EU / Bulgaria risks (priority order)

1. **3DS on renewals** — highest severity for BG/EU PSD2
2. **USD charges** — FX markup vs advertised €2.99
3. **No VAT invoices** — external process required
4. **Misleading price display** — consumer-law risk if UI says EUR, charge is USD

## Sources

- [Clerk Billing overview](https://clerk.com/docs/guides/billing/overview)
- [B2C TanStack Start](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c)
- [Billing webhooks](https://clerk.com/docs/tanstack-react-start/guides/development/webhooks/billing)
- `docs/specs/clerk-auth-billing-implementation.md`, `docs/clerk-production-setup.md`
- `research/clerk-billing-quotas.md`
