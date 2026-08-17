# Research: Merchant of record + Clerk auth (Paddle, Lemon Squeezy, Polar)

> **Decision:** We are **not** a MoR path. Host Pro is Stripe Billing (we remain the seller) — [ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md). Clerk stays for auth.

Part of wayfinder map [#132](https://github.com/HayGrouve/onova-za-smetkata/issues/132). Resolves [#134](https://github.com/HayGrouve/onova-za-smetkata/issues/134).

**Question:** Which merchant-of-record vendors (Paddle, Lemon Squeezy, Polar) can sell a **€2.99/mo B2C** Host subscription to customers in **Bulgaria first, then the EU**, with **SCA/3DS** and **VAT handled by the MoR**, while we keep **Clerk for auth** and Convex for quotas?

**Out of scope:** Guest restaurant-bill payments. Replacing Clerk auth. Changing Free/Pro quota numbers.

**Clerk Billing baseline (already documented):** Clerk is **not** a MoR; Billing is **USD-only**, **no 3DS**, **no VAT** ([Clerk Billing overview FAQ](https://clerk.com/docs/guides/billing/overview)). That stack cannot meet this ticket.

---

## Executive summary

| Criterion                                   | **Paddle**                                                                                                                                                                                                                                                                                                                                                                                      | **Lemon Squeezy**                                                                                                                                                                                                                                                                                           | **Polar**                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Seller of record vs MoR**                 | **MoR.** Paddle is the legal seller; collects/remits tax, PCI, refunds/chargebacks ([How Paddle works](https://developer.paddle.com/get-started/how-paddle-works)).                                                                                                                                                                                                                             | **MoR.** Lemon Squeezy sells on our behalf ([Merchant of Record](https://docs.lemonsqueezy.com/help/payments/merchant-of-record)).                                                                                                                                                                          | **MoR / reseller.** Polar buys from us and resells; Polar is the merchant on the sale ([MoR intro](https://polar.sh/docs/merchant-of-record/introduction), [MoR feature](https://polar.sh/features/merchant-of-record)).                                                                                                                                                                                                                |
| **EUR as charge currency**                  | **Yes.** EUR is a payment currency (min charge **0.65 EUR**). Balance/payouts can be EUR ([Supported currencies](https://developer.paddle.com/concepts/sell/supported-currencies)).                                                                                                                                                                                                             | **Display only.** Store can list **EUR**, but **all transactions are processed in USD** at mid-market FX. Payouts default USD ([Currencies](https://docs.lemonsqueezy.com/help/payments/currencies)).                                                                                                       | **Yes.** Products can be priced in **EUR** (130+ currencies). Org default currency can be EUR; checkout picks by geolocation ([Products](https://polar.sh/docs/features/products)).                                                                                                                                                                                                                                                     |
| **BG / EU buyers**                          | **BG listed** (`BG`, EUR, tax **inclusive**). EU members listed. Sanctions list does not include BG/EU ([Supported countries](https://developer.paddle.com/concepts/sell/supported-countries-locales)).                                                                                                                                                                                         | Cards worldwide; **EUR** and **BGN** in selling-currency list. No BG-specific buyer block in docs ([Payment methods](https://docs.lemonsqueezy.com/help/checkout/payment-methods), [Currencies](https://docs.lemonsqueezy.com/help/payments/currencies)).                                                   | Payments **globally except US-sanctioned** (CU, RU, IR, KP, SY). **Bulgaria is a payout country** ([Supported countries](https://polar.sh/docs/merchant-of-record/supported-countries)).                                                                                                                                                                                                                                                |
| **3DS / SCA**                               | **3DS2 at checkout** (bank SMS/app). Sandbox has “Valid card with 3DS”. Transaction `action_required` “typically means … 3DS” ([Cards](https://developer.paddle.com/concepts/payment-methods/card), [Update payment method transaction](https://developer.paddle.com/api-reference/subscriptions/get-subscription-update-payment-method-transaction)).                                          | Checkout **test card labeled “3D Secure”**. No dedicated SCA/renewal-3DS policy page found ([Test mode](https://docs.lemonsqueezy.com/help/getting-started/test-mode)). Processor on subscription webhooks is `"stripe"` ([Webhooks guide](https://docs.lemonsqueezy.com/guides/developer-guide/webhooks)). | **3DS in-modal** for cards. Off-session charge returns **402** if “3DS / SCA challenge that can't be completed off-session”. Changelog: 3DS retry modal ([Embed payment method](https://polar.sh/docs/features/checkout/embed-payment-method), [Orders](https://polar.sh/docs/features/orders), [Changelog](https://polar.sh/docs/changelog/recent)).                                                                                   |
| **VAT / invoices**                          | Calculates, collects, remits worldwide; “no need to register for VAT” in buyer countries ([How Paddle works](https://developer.paddle.com/get-started/how-paddle-works)). Portal: download PDF invoices ([Customer portal](https://developer.paddle.com/concepts/sell/customer-portal)). Sales-assisted invoicing may be **custom pricing** ([Paddle pricing](https://www.paddle.com/pricing)). | Collects/remits VAT as MoR; tax on invoices; deducted from payouts. Tax-inclusive store setting ([Sales tax and VAT](https://docs.lemonsqueezy.com/help/payments/sales-tax-vat)).                                                                                                                           | Liable as reseller. EU B2B reverse charge. **EU OSS VAT (Ireland)**, UK VAT, US states. PDF invoice + receipt per paid order ([MoR intro](https://polar.sh/docs/merchant-of-record/introduction), [Orders](https://polar.sh/docs/features/orders), [MoR feature](https://polar.sh/features/merchant-of-record)). Default EU presentation **inclusive** ([Tax inclusive pricing](https://polar.sh/docs/features/tax-inclusive-pricing)). |
| **Checkout + portal**                       | Hosted / overlay / inline (Paddle.js). Customer portal (magic link or API session); update PM, invoices, cancel ([How Paddle works](https://developer.paddle.com/get-started/how-paddle-works), [Integrate portal](https://developer.paddle.com/build/customers/integrate-customer-portal)).                                                                                                    | Hosted checkout or Lemon.js overlay. Portal `https://[STORE].lemonsqueezy.com/billing` or signed API URL ([Taking payments](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments), [Customer portal](https://docs.lemonsqueezy.com/help/online-store/customer-portal)).                     | Checkout session URL (redirect) + checkout links. Portal `https://polar.sh/<org>/portal` or `customerPortalUrl` from customer session. `external_customer_id` for our user id ([Checkout session](https://polar.sh/docs/features/checkout/session), [Navigate customers](https://polar.sh/docs/features/customer-portal/navigate-customers)).                                                                                           |
| **Webhooks → Convex httpAction**            | HTTPS **POST** JSON; `Paddle-Signature`; expect **200 within 5s**; at-least-once ([How webhooks work](https://developer.paddle.com/webhooks/about/how-webhooks-work)). Same pattern as `convex/http.ts` `/clerk/webhook`.                                                                                                                                                                       | HTTPS **POST** JSON; `X-Signature`; return **200**; retries up to 4 ([Webhooks guide](https://docs.lemonsqueezy.com/guides/developer-guide/webhooks)). `custom_data` for Clerk user id.                                                                                                                     | HTTPS **POST**; Standard Webhooks; Polar example returns **202**; **10s timeout**, recommend **2s** then queue ([Setup](https://polar.sh/docs/integrate/webhooks), [Delivery](https://polar.sh/docs/integrate/webhooks/delivery)). `customer.external_id` after checkout.                                                                                                                                                               |
| **Fees (list)**                             | **5% + 50¢** per checkout, marketed all-in (no monthly). **Products under $10 or invoicing: contact sales** ([Pricing](https://www.paddle.com/pricing)). €2.99 is under $10.                                                                                                                                                                                                                    | **5% + 50¢** + **1.5% international** + **0.5% subscriptions** + **1.5% PayPal**. Non-US bank payout **1%**. **Products lower than $10: contact sales** ([Fees](https://docs.lemonsqueezy.com/help/getting-started/fees)).                                                                                  | **Starter 5% + 50¢** (no monthly). **+1.5% international (non-US) cards**. No extra subscription fee on Starter/Pro/Growth/Scale. Paid plans lower variable rate. Payouts: Stripe Connect fees passed through ([Fees](https://polar.sh/docs/merchant-of-record/fees)).                                                                                                                                                                  |
| **Clerk coupling**                          | **None.** Clerk is not a MoR and Billing is Stripe-only ([Clerk FAQ](https://clerk.com/docs/guides/billing/overview)). Keep Clerk auth; map user ↔ Paddle `customer.id` via checkout custom data + webhooks.                                                                                                                                                                                    | **None.** Same. Pass Clerk user id in checkout `custom_data`.                                                                                                                                                                                                                                               | **None.** Optional **Better Auth** adapter exists; **no Clerk Billing integration**. Use `external_customer_id` = Clerk user id ([Checkout session](https://polar.sh/docs/features/checkout/session)).                                                                                                                                                                                                                                  |
| **Fits €2.99 EUR + BG/EU + 3DS + MoR VAT?** | **Yes, with sales caveat** (sub-$10 custom pricing).                                                                                                                                                                                                                                                                                                                                            | **No for advertised EUR charge** (USD processing). MoR VAT and 3DS test cards exist.                                                                                                                                                                                                                        | **Yes.** EUR catalog price; 3DS documented; MoR VAT. Almost every BG/EU card pays **+1.5%** international.                                                                                                                                                                                                                                                                                                                              |

**They are not equivalent.** Lemon Squeezy repeats Clerk Billing’s **USD settlement** problem. Paddle and Polar both meet MoR + EUR charge + BG/EU + 3DS + Clerk-beside-auth.

**Recommendation: Paddle** as the Host Pro MoR — first-class **EUR charging and EUR balance**, Bulgaria listed with **inclusive** tax, documented **3DS2**, all-in fee **without** Polar’s **+1.5% non-US card** surcharge on the BG/EU audience. Polar is the closest alternative if Paddle will not onboard a **€2.99** product on self-serve 5%+50¢.

---

## Architecture (any chosen MoR)

```
Host (Clerk session) → MoR checkout (email/custom id = Clerk user)
MoR webhooks POST → Convex httpAction → hostTier / quotas (source of truth)
Host UI: MoR portal link for invoices / PM / cancel (not Clerk <PricingTable />)
```

Guest claim/join unchanged. Do **not** enable Clerk Billing.

Convex already accepts signed POSTs (`/clerk/webhook`). Add a second path (`/paddle/webhook` or `/polar/webhook`), verify signature in a `"use node"` action, persist subscription status, enforce in `convex/lib/hostTier.ts`.

---

## Paddle

### Role

Paddle is an “all-in-one payments and billing **merchant of record**”. A MoR is “a legal entity responsible for selling goods or services to an end customer” and takes tax, PCI, refunds, and chargebacks. We do not register for VAT in buyer countries ([How Paddle works](https://developer.paddle.com/get-started/how-paddle-works)).

We are **not** seller of record on the card statement; “Your name appears on the customer's statement alongside Paddle's.”

### Currency and Bulgaria

- Payment currencies include **EUR** (2 decimals, min **0.65**). Hold balance in EUR; payouts in EUR ([Supported currencies](https://developer.paddle.com/concepts/sell/supported-currencies)).
- **BG / Bulgaria / EUR / Inclusive** in the supported-country table. Other EU states likewise ([Supported countries](https://developer.paddle.com/concepts/sell/supported-countries-locales)).
- Prices can be country-overridden; euro-area countries can share a EUR base with per-country overrides ([Localized pricing](https://developer.paddle.com/build/products/offer-localized-pricing)).

€2.99/mo is above the EUR minimum. Whether advertised price is **tax-inclusive** should use Paddle tax mode / BG inclusive preference so checkout matches „€2.99/мес.“.

### 3DS / SCA

Checkout “sometimes” asks for **3D Secure 2**. Sandbox: `4000 0038 0000 0446` = “Valid card with 3DS” ([Cards](https://developer.paddle.com/concepts/payment-methods/card)). API: payment `action_required` “Typically means that the payment attempt requires 3DS”; `authentication_failed` after a failed 3DS challenge ([Get update-payment-method transaction](https://developer.paddle.com/api-reference/subscriptions/get-subscription-update-payment-method-transaction)).

Renewals: Paddle creates a `subscription_recurring` transaction; `past_due` + Retain retries; customers update PM via portal or Paddle.js ([Update payment details](https://developer.paddle.com/build/subscriptions/update-payment-details)). Docs do not say off-session 3DS is impossible (unlike Clerk).

### VAT and invoices

Worldwide tax calculated, collected, remitted ([How Paddle works](https://developer.paddle.com/get-started/how-paddle-works)). Portal: past payments and **PDF invoices** ([Customer portal](https://developer.paddle.com/concepts/sell/customer-portal)). Pricing page: invoicing as an additional feature with **custom pricing** for “products under $10 or require invoicing” ([Pricing](https://www.paddle.com/pricing)).

### Checkout, portal, webhooks

Overlay/inline/hosted checkout; customer portal with authenticated sessions ([Integrate portal](https://developer.paddle.com/build/customers/integrate-customer-portal)). Provision via `subscription.created` / `subscription.updated` ([Provision access](https://developer.paddle.com/build/subscriptions/provision-access-webhooks)).

Webhooks: HTTP POST, `Paddle-Signature`, 200 in **5 seconds**, retries, `event_id` dedupe ([How webhooks work](https://developer.paddle.com/webhooks/about/how-webhooks-work)). Convex: ack fast, process in an internal action.

### Fees

**5% + 50¢** per checkout transaction, no monthly fee on pay-as-you-go ([Pricing](https://www.paddle.com/pricing)). **Open item:** €2.99 ≈ under $10 → “contact us for bespoke pricing.” Treat as a **sales gate**, not a documented technical block.

### Clerk

No first-party Clerk integration. Keep Clerk; store Paddle `customer_id` / `subscription_id` on the host user.

---

## Lemon Squeezy

### Role and Stripe ownership

Lemon Squeezy **is** a merchant of record ([Merchant of Record](https://docs.lemonsqueezy.com/help/payments/merchant-of-record)). Stripe lists **Lemon Squeezy, LLC** as an **acquired Stripe Affiliate Sub-processor** for “Merchant of record related services” ([Stripe service providers](https://stripe.com/legal/service-providers), last updated 20 Dec 2025). Lemon Squeezy site footer: **“Sold through Link, LLC f/k/a Lemon Squeezy LLC”** ([Pricing](https://www.lemonsqueezy.com/pricing)). First-party Lemon Squeezy blog titles still say **“Stripe acquires Lemon Squeezy”** ([Blog](https://www.lemonsqueezy.com/blog/stripe-acquires-lemon-squeezy)); article bodies did not reliably load in this fetch. Subscription webhook `payment_processor` is `"stripe"` ([Webhooks guide](https://docs.lemonsqueezy.com/guides/developer-guide/webhooks)).

### Currency — blocker for this product

Docs are explicit:

> Lemon Squeezy processes all transactions in US dollars (USD)  
> Although we display your products in one of the many currencies we offer, ultimately we charge your customers the equivalent cost in USD.

EUR is a **supported selling (display) currency**. Payouts are **always made in USD** (bank payout may convert) ([Currencies](https://docs.lemonsqueezy.com/help/payments/currencies)).

That is the same class of mismatch as Clerk Billing USD-only vs locked **€2.99** copy (`research/clerk-billing-platform-constraints.md`).

### BG / EU, 3DS, VAT

- Cards worldwide; subscriptions: cards, Apple Pay, Google Pay, PayPal ([Payment methods](https://docs.lemonsqueezy.com/help/checkout/payment-methods)).
- Test cards include **“3D Secure: `4000 0027 6000 3184`”** ([Test mode](https://docs.lemonsqueezy.com/help/getting-started/test-mode)). No first-party page found that states SCA coverage on **renewals**.
- VAT collected/remitted as MoR; invoices show tax; tax-inclusive store setting ([Sales tax and VAT](https://docs.lemonsqueezy.com/help/payments/sales-tax-vat)).

### Checkout, portal, webhooks

Hosted or overlay (`LemonSqueezy.Url.Open`) ([Taking payments](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments)). Portal URL or signed subscription/customer URL ([Customer portal](https://docs.lemonsqueezy.com/help/online-store/customer-portal)).

Webhooks: POST JSON, `X-Signature`, HTTP 200, `custom_data` for our user id ([Webhooks guide](https://docs.lemonsqueezy.com/guides/developer-guide/webhooks)). Compatible with Convex httpActions.

### Fees

5% + 50¢ on **total including tax**, plus **+1.5% international**, **+0.5% subscriptions** ([Fees](https://docs.lemonsqueezy.com/help/getting-started/fees)). Example is a France VAT card purchase. **Products lower than $10: contact sales.** Non-US bank payout **1%**.

### Clerk

None. Do not use Clerk Billing.

---

## Polar

### Role

Polar is a MoR **reseller**: “handles international taxes by being a reseller of your digital goods & services.” Polar is **liable** for capturing and remitting sales tax; we remain liable for **income tax** in our residence ([MoR intro](https://polar.sh/docs/merchant-of-record/introduction)). Feature page: Polar buys the good and resells; “international sales tax … is owed by us, not you.” Registrations include **EU OSS VAT (Ireland)** ([MoR feature](https://polar.sh/features/merchant-of-record)). Built on **Stripe** (+ more PSPs later) ([MoR intro](https://polar.sh/docs/merchant-of-record/introduction)). Customer payments are made to **Polar (US)**; we receive **Stripe Connect Express** payouts ([Supported countries](https://polar.sh/docs/merchant-of-record/supported-countries)).

### Currency and Bulgaria

- **EUR** is a first-class product price currency. Set org **default payment currency** to EUR to sell EUR-only ([Products](https://polar.sh/docs/features/products)).
- Checkout geolocation (or `customer_ip_address` when creating sessions from a backend) drives currency and tax country ([Checkout session](https://polar.sh/docs/features/checkout/session)). Convex/Vercel backends **must** forward the Host’s IP or BG/EU tax/currency will be wrong.
- Buyer coverage: global except US sanctions list. **Bulgaria** is on the **payout** country list (Stripe Connect Express) ([Supported countries](https://polar.sh/docs/merchant-of-record/supported-countries)). Bank must be **same country and local currency** as the business ([Payout accounts](https://polar.sh/docs/features/finance/accounts)).

### 3DS / SCA

- “Card payments (3DS) complete inside the modal” ([Embed payment method](https://polar.sh/docs/features/checkout/embed-payment-method)).
- Off-session finalize: **402** if the charge “needs a 3DS / SCA challenge that can't be completed off-session” ([Orders](https://polar.sh/docs/features/orders)).
- Changelog: “3DS modal display (popup instead of redirect)”, retry after 3DS cancellation ([Changelog](https://polar.sh/docs/changelog/recent)).
- `subscription.past_due` / payment-failed events: customer recovers by updating PM ([Webhook events](https://polar.sh/docs/integrate/webhooks/events)).

### VAT and invoices

Correct rate by location and tax status; EU B2B reverse charge; remittance and OSS ([MoR intro](https://polar.sh/docs/merchant-of-record/introduction)). PDF invoice per paid order; customers can add VAT number in portal ([Orders](https://polar.sh/docs/features/orders)). Default **location-based** tax behavior: **inclusive** outside US/CA/IN ([Tax inclusive pricing](https://polar.sh/docs/features/tax-inclusive-pricing)) — matches EU advertised €2.99 including VAT if we set **€2.99 inclusive**.

### Checkout, portal, webhooks

Create checkout session → redirect `checkout.url`. Prefill/lock email when `external_customer_id` is set (Clerk user id) ([Checkout session](https://polar.sh/docs/features/checkout/session)). Portal via org URL or customer session ([Navigate customers](https://polar.sh/docs/features/customer-portal/navigate-customers)).

Webhooks: Standard Webhooks, custom HTTPS URL, signature secret, Polar CLI tunnel for local. Timeouts **10s**, recommend **2s** + background work; **no redirect following** (Convex `*.convex.site` URL must be the final URL) ([Delivery](https://polar.sh/docs/integrate/webhooks/delivery)). Events: `subscription.created/updated/cycled/past_due`, `order.paid` ([Webhook events](https://polar.sh/docs/integrate/webhooks/events)).

### Fees

Starter: **5% + 50¢**. **+1.5% international (non-US) cards** on top. Example is a **Swedish VAT** purchase on an international card ([Fees](https://polar.sh/docs/merchant-of-record/fees)). For a **Bulgarian/EU** card base, that surcharge likely applies to **most** Host Pro sales (Polar is US MoR). No public “under $10 contact sales” gate.

### Clerk

No Clerk Billing. Polar documents a **Better Auth** plugin; that is optional and **not required**. `external_customer_id` is the intended join key for an existing identity system.

---

## Clerk (auth only)

From [Clerk Billing overview](https://clerk.com/docs/guides/billing/overview):

- “Is Clerk a Merchant of Record (MoR) for transactions? **No.**”
- Billing: **USD only**; **no tax/VAT**; **no 3DS** (EU/UK especially; background renewals fail).
- Billing uses **Stripe for payment processing only**; not Stripe Billing; **no** third-party billing tools except via Stripe.

Implication: **do not** pair Clerk Billing with a MoR. Keep **Clerk for Host auth**. Quotas stay in Convex.

---

## Recommendation

**Choose Paddle** as the MoR for Host Pro, unless Paddle sales refuses €2.99 on the public 5%+50¢ plan.

| Why Paddle over Polar                                       | Why not Lemon Squeezy                                      |
| ----------------------------------------------------------- | ---------------------------------------------------------- |
| Charges and can settle in **EUR**, not USD FX               | **Charges USD** while displaying EUR                       |
| BG in country table with **inclusive** tax                  | Same FX/consumer-copy issue as Clerk Billing               |
| All-in **5% + 50¢** (no listed +1.5% non-US card fee)       | Extra **1.5% + 0.5% sub** on almost every EU sale          |
| Documented **3DS2** + subscription engine + portal invoices | 3DS test card only; no EUR settlement                      |
| Overlay/inline checkout for the PWA                         | Stripe-owned MoR is fine legally; **currency** is the miss |

**Polar** if: Paddle blocks sub-$10 SKUs, or we want `external_customer_id` + Standard Webhooks with less sales process. Budget the **+1.5%** international card fee and **forward customer IP** from Convex/Vercel when creating checkouts.

**Lemon Squeezy:** MoR VAT is real, but it **does not satisfy** “sell €2.99/mo” as a **EUR charge**. Do not pick it to fix Clerk’s USD/3DS problems.

**None of the three couple to Clerk Billing.** Clerk stays for auth in all viable paths.

Open for grilling (#137): confirm Paddle will price a **€2.99** inclusive monthly SaaS SKU; confirm Polar EUR default + BG Connect payout for our legal entity; map 7-day `past_due` grace onto Paddle/Polar statuses.

---

## Sources

### Paddle

- https://developer.paddle.com/get-started/how-paddle-works
- https://developer.paddle.com/get-started/how-paddle-works/saas
- https://developer.paddle.com/concepts/sell/supported-countries-locales
- https://developer.paddle.com/concepts/sell/supported-currencies
- https://developer.paddle.com/concepts/payment-methods/card
- https://developer.paddle.com/concepts/sell/customer-portal
- https://developer.paddle.com/build/customers/integrate-customer-portal
- https://developer.paddle.com/build/subscriptions/provision-access-webhooks
- https://developer.paddle.com/build/subscriptions/update-payment-details
- https://developer.paddle.com/webhooks/about/how-webhooks-work
- https://developer.paddle.com/api-reference/subscriptions/get-subscription-update-payment-method-transaction
- https://www.paddle.com/pricing
- https://mor.paddle.com/

### Lemon Squeezy

- https://docs.lemonsqueezy.com/help/payments/merchant-of-record
- https://docs.lemonsqueezy.com/help/payments/sales-tax-vat
- https://docs.lemonsqueezy.com/help/payments/currencies
- https://docs.lemonsqueezy.com/help/getting-started/fees
- https://docs.lemonsqueezy.com/help/getting-started/test-mode
- https://docs.lemonsqueezy.com/help/checkout/payment-methods
- https://docs.lemonsqueezy.com/help/online-store/customer-portal
- https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
- https://docs.lemonsqueezy.com/guides/developer-guide/webhooks
- https://www.lemonsqueezy.com/pricing
- https://www.lemonsqueezy.com/blog/stripe-acquires-lemon-squeezy
- https://stripe.com/legal/service-providers

### Polar

- https://polar.sh/docs/merchant-of-record/introduction
- https://polar.sh/docs/merchant-of-record/fees
- https://polar.sh/docs/merchant-of-record/supported-countries
- https://polar.sh/features/merchant-of-record
- https://polar.sh/docs/features/products
- https://polar.sh/docs/features/tax-inclusive-pricing
- https://polar.sh/docs/features/orders
- https://polar.sh/docs/features/checkout/session
- https://polar.sh/docs/features/checkout/embed-payment-method
- https://polar.sh/docs/features/customer-portal/navigate-customers
- https://polar.sh/docs/features/finance/accounts
- https://polar.sh/docs/integrate/webhooks
- https://polar.sh/docs/integrate/webhooks/delivery
- https://polar.sh/docs/integrate/webhooks/events
- https://polar.sh/docs/changelog/recent

### Clerk

- https://clerk.com/docs/guides/billing/overview

### This repo

- `research/clerk-billing-platform-constraints.md`
- `convex/http.ts` (existing Clerk webhook httpAction)
