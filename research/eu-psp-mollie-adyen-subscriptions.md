# Research: EU PSP subscriptions + Clerk auth (Mollie, Adyen)

> **Decision:** Host Pro is Stripe Billing, not Mollie/Adyen — [ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md). Clerk stays for auth.

Part of wayfinder map [#132](https://github.com/HayGrouve/onova-za-smetkata/issues/132). Resolves [#135](https://github.com/HayGrouve/onova-za-smetkata/issues/135).

**Question:** Can an EU-native PSP — at least **Mollie** and **Adyen** — run **recurring EUR subscriptions** with **SCA/3DS** for Bulgarian (then EU) cardholders, as an alternative to Stripe Billing and Clerk Billing, while **Clerk stays for auth**?

**Scope:** Host SaaS Pro (~€2.99/mo). Guest Revolut is out of scope. Quotas stay in Convex. Primary sources only (official Mollie / Adyen docs and first-party pages).

---

## Verdicts (read this first)

| PSP        | Fit for this project                                                                     | One line                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mollie** | **Conditional good-fit for the payment rails; not a better product than Stripe Billing** | Has a real Subscriptions API, EUR cards + SEPA, 3DS on the first/mandate payment, and a June 2026 Bulgaria merchant launch — but you remain merchant of record for VAT, BG merchants may hit a **minimum sales volume**, and you still build checkout + Convex entitlement + invoices. |
| **Adyen**  | **Poor fit for ~€3/mo Host SaaS**                                                        | Technically can do EUR MIT subscriptions with SCA/3DS, and Bulgaria appears in their pricing, SCA, and onboarding docs — but there is **no Stripe-like billing product**, live access is **sales-led with a minimum invoice**, and you must schedule every renewal yourself.           |

Neither PSP replaces Clerk. Both are payment processors you sit **beside** Clerk (map `clerkUserId` → Mollie `customerId` or Adyen `shopperReference` in Convex).

---

## Shared constraints (both PSPs)

- **Clerk stays for auth.** Mollie and Adyen do not issue Host sessions. Checkout is a redirect / Drop-in after the Host is already signed in.
- **You are the merchant of record.** Neither product remits EU B2C VAT on the Host’s behalf the way a MoR (Paddle / Lemon Squeezy / Polar) would. Tax is your legal obligation; the APIs only help you _record_ VAT on invoices (Mollie) or pass tax line items for some methods (Adyen Klarna, etc.).
- **Convex remains the quota source of truth.** PSP webhooks update subscription state; `shared` + `convex/lib/hostTier.ts` still gate bills/OCR.
- **Guest restaurant settlement is out of scope.** Local methods below are only relevant if they help Hosts pay Pro.

---

## Mollie

### Subscriptions vs one-off

**Subscriptions are a first-class API, not one-off only.**

1. Create a Customer ([Customers API](https://docs.mollie.com/reference/customers-api)).
2. Create a **first** payment with `sequenceType: first` (and `customerId`). After success, a **mandate** exists ([Mandates API](https://docs.mollie.com/reference/mandates-api); [Recurring payments](https://docs.mollie.com/docs/recurring-payments)).
3. Either:
   - Charge on-demand with `sequenceType: recurring` + `mandateId`, or
   - Create a **subscription** (`interval`, `amount`, optional `times` / `startDate`) via the [Subscriptions API](https://docs.mollie.com/reference/subscriptions-api). Mollie then **spawns payments automatically**.

Cards (incl. Apple Pay / Google Pay) create a `creditcard` mandate. Several bank methods create a `directdebit` mandate if SEPA Direct Debit is enabled on the profile ([Recurring payments](https://docs.mollie.com/docs/recurring-payments)).

Cards support a **€0 first payment** to authorise the mandate without debiting, then a subscription with `startDate` after the first period ([Recurring payments](https://docs.mollie.com/docs/recurring-payments); [Cards](https://docs.mollie.com/docs/cards) — Recurring: Yes, First Payment Method: Yes, min amount EUR 0.00).

Recurring is **API-only** (not the Mollie Web app) ([Recurring payments](https://docs.mollie.com/docs/recurring-payments)). Recurring is listed as included at no extra product fee on [Mollie Pricing](https://www.mollie.com/pricing).

### Bulgaria as seller

- Official launch: **3 June 2026** — Mollie announced merchant services in Bulgaria (cards + Apple Pay / Google Pay as the headline methods) ([Mollie launches in Bulgaria](https://www.mollie.com/news/mollie-launches-bulgaria)).
- Help Centre: services are offered to companies in the EEA, Switzerland, or the UK; the country list **includes Bulgaria**. The EN-GB article marks **Bulgaria\*** (and several other countries) with a **minimum sales volume** — eligibility via the sales contact form. Signup requires an **IBAN or UK bank account** ([Can I use Mollie's services in my country?](https://help.mollie.com/hc/en-gb/articles/115002116105-Can-I-use-Mollie-s-services-in-my-country)).
- Cards: **supported merchant locations = Global** ([Cards](https://docs.mollie.com/docs/cards)).
- SEPA Direct Debit: **supported merchant locations = EEA, UK, Switzerland** ([SEPA Direct Debit](https://docs.mollie.com/docs/sepa-direct-debit)).

**Implication:** a Bulgarian legal entity _can_ be a Mollie merchant after the 2026 launch, but a pre-revenue / tiny-volume Host SaaS may be **refused or delayed** if the BG asterisk still applies. Confirm with Mollie sales before choosing this path.

### Bulgaria as buyer (then EU)

- **Cards:** available country codes **Global** — Bulgarian and other EU cardholders are in scope ([Cards](https://docs.mollie.com/docs/cards)).
- **SEPA Direct Debit:** debtor country list includes **`BG`** and the rest of the EU/EEA ([SEPA Direct Debit](https://docs.mollie.com/docs/sepa-direct-debit)).
- Hosted Checkout reorders methods by shopper country (e.g. iDEAL first in NL, Bancontact first in BE) ([Hosted checkout](https://docs.mollie.com/docs/hosted-checkout)).

### Local methods (Host SaaS relevance)

For a **€2.99/mo B2C Host plan**, the useful rails are:

| Method                                  | Recurring?                                                                                                                   | Notes                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creditcard` (+ Apple Pay / Google Pay) | Yes (card mandate)                                                                                                           | Primary path for BG Hosts.                                                                                                                                                                                                                                                    |
| `directdebit` (SEPA)                    | Yes                                                                                                                          | Cheap (€0.35 on [pricing](https://www.mollie.com/pricing)); 8-week chargeback window ([SEPA DD](https://docs.mollie.com/docs/sepa-direct-debit)). First payment via Bancontact / iDEAL / EPS / KBC / Pay by Bank / etc. — **not BG-native banks** on that first-payment list. |
| Bancontact, iDEAL, BLIK, Przelewy24, …  | Bancontact itself: Recurring **No** ([Bancontact](https://docs.mollie.com/docs/bancontact)); several can seed a SEPA mandate | Useful for **EU expansion checkout**, not for BG-first Hosts.                                                                                                                                                                                                                 |

Do not build Host Pro around iDEAL/Bancontact. Cards (+ optional SEPA later) are enough.

### 3DS / SCA on mandates and renewals

- First / customer-present card payments: after Create Payment, redirect to `_links.checkout.href` for **3-D Secure** ([Mollie Components](https://docs.mollie.com/docs/mollie-components)).
- Payment extras: `details.cardSecurity` is `normal` or `3dsecure`; `details.card3dsEci` is the 3DS outcome and is **valid only for `oneoff` and `first`** ([Extra payment parameters](https://docs.mollie.com/reference/extra-payment-parameters)).
- Recurring charges: `sequenceType: recurring` runs **in the background without a browser session** ([Recurring payments](https://docs.mollie.com/docs/recurring-payments)). That is the MIT / mandate model: SCA on the first payment, not on each spawned subscription payment.
- Saved-card **customer-present** (`sequenceType: oneoff`) is a different guide; Mollie says those payments usually redirect again so SCA can be applied ([Saving a card for returning customers](https://docs.mollie.com/docs/saving-a-card-for-returning-customers)). Do not use that path for monthly Pro renewals.

**Failed renewals:** Mollie may retry a failed subscription payment **up to 5 times** (once a day, method/reason-dependent), then **cancel the subscription**. Some SEPA reason codes cancel immediately or after 3 failures. There are **no webhooks for subscription status changes** — only for the spawned payments ([Recurring payments](https://docs.mollie.com/docs/recurring-payments)). Map this onto the project’s 7-day `past_due` rule carefully: Mollie’s retry window can outlast or collide with Convex grace.

### Tax

- Mollie is **not** a merchant of record. You charge EUR; you invoice VAT.
- [Sales Invoices API](https://docs.mollie.com/reference/create-sales-invoice): `vatScheme` = `standard` or `one-stop-shop` (**OSS only if enrolled**); `vatMode` inclusive/exclusive; line `vatRate` / `vatAmount`.
- This is invoicing assistance, not automatic EU VAT determination or remittance.

### Webhooks

- Per-resource `webhookUrl` on payments / subscriptions ([Webhooks](https://docs.mollie.com/reference/webhooks)).
- Payload is typically `id=tr_…`. You **GET the payment** (security: status is not in the POST).
- Subscription webhooks fire **per spawned payment**; the payment includes `subscriptionId`. Unknown payment IDs are expected ([Recurring payments](https://docs.mollie.com/docs/recurring-payments)).
- Retry: 10 attempts over ~26 hours; 15s timeout; respond `200` ([Webhooks](https://docs.mollie.com/reference/webhooks)).
- Next-gen Webhooks (beta) exist ([Webhooks](https://docs.mollie.com/reference/webhooks)).

Convex fit: one `convex/http.ts` route, fetch payment, update Host tier. No official Convex/Mollie SDK required.

### Implementation weight vs Stripe (Convex + TanStack Start)

**Lighter than Adyen, heavier than Stripe Billing.**

You would build:

1. Hosted Checkout or Mollie.js Components + 3DS redirect (TanStack Start).
2. Customer + first payment + Create Subscription (Convex action / HTTP).
3. Webhook → entitlement (you already do this pattern for Clerk).
4. Self-serve cancel / update (Mollie has cancel/update subscription endpoints; **no hosted customer portal** like Stripe Billing).
5. VAT invoices (Sales Invoices API or your own).
6. Dunning UX when retries fail and the subscription is cancelled with no status webhook.

Pricing (indicative, [mollie.com/pricing](https://www.mollie.com/pricing)): EEA consumer Visa/Mastercard **1.80% + €0.25**; “No minimum costs”. On €2.99 that is about **€0.30 (~10%)** per successful charge — workable, not elegant. SEPA DD is €0.35 flat (worse on this ticket size unless you batch differently).

---

## Adyen

### Subscriptions vs one-off

**Adyen processes recurring card (and SEPA) payments. It does not run a Stripe Billing–style subscription product.**

- Tokenize on first payment (`recurringProcessingModel: Subscription`, `shopperInteraction: Ecommerce`) via `/sessions` or `/payments` ([Create tokens](https://docs.adyen.com/online-payments/tokenization/create-tokens)).
- Later charges: **you** call `/payments` with `storedPaymentMethodId`, same `shopperReference`, `recurringProcessingModel: Subscription`, `shopperInteraction: ContAuth` ([Make token payments](https://docs.adyen.com/online-payments/tokenization/make-token-payments)).
- Limitation: `/sessions` can **create** tokens; **subsequent subscription / UCOF charges require `/payments`** ([Create tokens](https://docs.adyen.com/online-payments/tokenization/create-tokens)).
- Zero-value auth is supported for cards; some methods (e.g. iDEAL) forbid amount `0` ([Create tokens](https://docs.adyen.com/online-payments/tokenization/create-tokens)).

There is no Adyen API that “charge €2.99 every month and email invoices.” Scheduling, retries, proration, and customer portal are **your** (or Convex cron / workflow) problem.

### Bulgaria as seller

- [Adyen Pricing](https://www.adyen.com/pricing) includes **Bulgaria** in the location picker (they quote method fees by shopper/merchant location).
- Live application requires company docs, **VAT/tax proof**, and website content checks. Bulgaria VAT format: `BG` + 9 or 10 digits ([Application requirements](https://docs.adyen.com/get-started-with-adyen/application-requirements)).
- Platforms / marketplaces: Bulgaria is a supported operating country for hosted onboarding ([Onboard users](https://docs.adyen.com/marketplaces/onboard-users/); [Platforms countries](https://docs.adyen.com/platforms.md)). That is Adyen for Platforms, not required for a single Host SaaS merchant — but it shows BG is in their KYC geography.
- Help: new merchants start by **contacting sales** ([How do I add a merchant account?](https://help.adyen.com/knowledge/account/account-settings/how-do-i-add-a-merchant-account)).
- Pricing FAQ: **no setup/monthly/integration/closure fees**, but **“We do have a minimum invoice depending on industry or business model”** — talk to sales ([Adyen Pricing](https://www.adyen.com/pricing)).

**Implication:** a Bulgarian company can apply. A ~€3/mo pre-scale SaaS is the opposite of Adyen’s usual volume. The unpublished **minimum invoice** is the commercial killer.

### Bulgaria as buyer (then EU)

- PSD2 SCA in-scope countries explicitly include **Bulgaria** (issuer and acquirer in EEA/Monaco/CH/UK) ([PSD2 SCA compliance guide](https://docs.adyen.com/online-payments/psd2-sca-compliance-and-implementation-guide)).
- Cards + wallets via Drop-in / Sessions; `countryCode` filters methods ([Sessions flow](https://docs.adyen.com/online-payments/build-your-integration/sessions-flow)).
- SEPA Direct Debit is a documented recurring-capable method ([SEPA DD Web Drop-in](https://docs.adyen.com/payment-methods/sepa-direct-debit/web-drop-in)).

### Local methods (Host SaaS relevance)

Same conclusion as Mollie: **cards + Apple Pay / Google Pay** for BG Hosts; SEPA if you want bank debit; NL/BE/PL locals only when expanding. Adyen’s value is local acquiring at scale, not a BG-specific Host checkout method.

### 3DS / SCA on mandates and renewals

- Recommended SCA method: **3D Secure 1 or 2** ([PSD2 SCA guide](https://docs.adyen.com/online-payments/psd2-sca-compliance-and-implementation-guide); [3DS for regulation compliance](https://docs.adyen.com/online-payments/3d-secure-for-regulation-compliance)).
- **Subscriptions:** “SCA is required for the **initial** payment.” Parameters: first = `Subscription` + `Ecommerce`; later = `Subscription` + `ContAuth` ([Implement SCA compliance](https://docs.adyen.com/online-payments/psd2-sca-compliance-and-implementation-guide/sca-options)).
- Default path: Authentication Engine **does not trigger 3DS for out-of-scope** transactions and **requests exemptions when applicable** ([Implement SCA compliance](https://docs.adyen.com/online-payments/psd2-sca-compliance-and-implementation-guide/sca-options)).
- Tokenization docs: for `Subscription` and `UnscheduledCardOnFile`, **SCA is required for the initial payment** ([Create tokens](https://docs.adyen.com/online-payments/tokenization/create-tokens)).
- Live website rules for subscriptions: explicit consent, **reminder ≥ 7 days** before charging after a trial/price change, easy cancel, receipt contents ([Application requirements — Subscriptions and free trials](https://docs.adyen.com/get-started-with-adyen/application-requirements)).

Renewals are MIT / `ContAuth`. If an issuer still demands SCA on a renewal, you must handle a challenge (shopper-present) — Adyen documents this more explicitly than Mollie. That is extra product work for `past_due` + 3DS email-back-to-checkout.

### Tax

- Adyen invoices **you** for processing. They **do not deduct sales tax/VAT from settlement batches**; VAT on _their_ fees appears for some billed entities (US sales tax, France financial-services VAT) ([Payment processing invoice](https://docs.adyen.com/reporting/invoice-reconciliation/payment-processing-invoice)).
- That is **not** Host→customer VAT. You still implement EU OSS / BG VAT yourself.
- `lineItems.taxPercentage` etc. exist for methods like Klarna ([Invoice lines](https://docs.adyen.com/payment-methods/klarna/invoice-lines/)) — not a tax engine for card SaaS.

### Webhooks

- **Standard webhooks**, default `AUTHORISATION` — rely on this for business logic even if the API returned a result ([Webhook types](https://docs.adyen.com/development-resources/webhooks/webhook-types)).
- **Recurring tokens life cycle:** `recurring.token.created` / `.updated` / `.disabled` / `.alreadyExisting` ([Create tokens](https://docs.adyen.com/online-payments/tokenization/create-tokens); [Token created](https://docs.adyen.com/api-explorer/Tokenization-webhooks/latest/post/recurring.token.created)).
- HMAC verification ([Verify HMAC](https://docs.adyen.com/development-resources/webhooks/secure-webhooks/verify-hmac-signatures)).
- Configure at company account ([Configure webhooks](https://docs.adyen.com/development-resources/webhooks/configure-and-manage)).

Convex fit: doable, more event types and HMAC surface than Mollie’s `id` + GET.

### Implementation weight vs Stripe (Convex + TanStack Start)

**Heaviest of the three (Adyen much heavier than Mollie, which is heavier than Stripe Billing).**

You would build: Web Drop-in + `/sessions` for first 3DS payment, `/payments` for every renewal (cron), token webhooks, AUTHORISATION webhooks, your own dunning and 3DS-recovery checkout, invoices, and a sales/KYC process before go-live.

Indicative fees ([Adyen Pricing](https://www.adyen.com/pricing)): **fixed processing fee + method fee** (cards often Interchange++ + markup; SEPA listed as processing + 0.80% + €0.25 in the explorer). Plus the **minimum invoice**. On €2.99 volume that minimum dominates.

---

## Clerk auth beside either PSP

| Concern          | Mollie                                             | Adyen                                                                                                                                                   |
| ---------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity         | Clerk session only                                 | Clerk session only                                                                                                                                      |
| PSP customer key | Store `cst_…` on the Convex user                   | Store `shopperReference` (you choose; **no PII** in the reference — [Create tokens](https://docs.adyen.com/online-payments/tokenization/create-tokens)) |
| Checkout UI      | Replace Clerk `<PricingTable />` / `startCheckout` | Same                                                                                                                                                    |
| Plan claims      | Do not use Clerk Billing `has({ plan })`           | Same — Convex webhooks + `hostTier`                                                                                                                     |

No first-party doc says Mollie or Adyen require their own login. Coupling risk is operational (two dashboards), not protocol.

---

## Economics of ~€3/mo

|                      | Mollie (EEA consumer card)                                      | Adyen                                                                        |
| -------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Published take-rate  | 1.80% + €0.25 ≈ **€0.30 / €2.99**                               | $0.13 + IC++ / method fee; **minimum invoice unspecified**                   |
| Monthly platform fee | **None** advertised ([Pricing](https://www.mollie.com/pricing)) | **None**, but **minimum invoice** ([Pricing](https://www.adyen.com/pricing)) |
| Billing product      | Subscriptions API (scheduler only)                              | Tokens only                                                                  |
| BG seller friction   | Launched 2026; possible **min volume**                          | Sales + KYC + min invoice                                                    |

Adyen is a **poor fit** at this price and stage. Mollie is **fee-viable** if you accept ~10% processing on cards and you pass merchant onboarding.

---

## Recommendation vs Stripe (this project)

Keep **Clerk for Host auth**. Do **not** choose **Adyen** for Pro: it can do EUR + SCA/3DS recurring cards, but it is an enterprise processor with a minimum invoice and no subscription scheduler — the wrong weight for a Convex + TanStack Start B2C app at €2.99/mo. **Mollie can** run the same EUR + 3DS-on-mandate + monthly Subscriptions API flow for Bulgarian sellers (since June 2026) and Bulgarian/EU cardholders, and it is the only of the two that is a plausible DIY alternative to Stripe. It is still **not better than Stripe Billing** for this codebase: you remain MoR for VAT, you must confirm BG minimum-volume eligibility, you get no hosted portal/tax/dunning product, and you will write more Convex webhook and billing state than Stripe Checkout + Billing webhooks. Prefer Stripe Billing unless Stripe is blocked; treat Mollie as the EU-native fallback after that eligibility check; treat Adyen as out.

---

## Sources

### Mollie (first-party)

- https://docs.mollie.com/docs/recurring-payments
- https://docs.mollie.com/reference/subscriptions-api
- https://docs.mollie.com/reference/mandates-api
- https://docs.mollie.com/docs/cards
- https://docs.mollie.com/docs/sepa-direct-debit
- https://docs.mollie.com/docs/mollie-components
- https://docs.mollie.com/docs/saving-a-card-for-returning-customers
- https://docs.mollie.com/reference/extra-payment-parameters
- https://docs.mollie.com/docs/hosted-checkout
- https://docs.mollie.com/docs/bancontact
- https://docs.mollie.com/reference/webhooks
- https://docs.mollie.com/reference/create-sales-invoice
- https://www.mollie.com/pricing
- https://www.mollie.com/news/mollie-launches-bulgaria
- https://help.mollie.com/hc/en-gb/articles/115002116105-Can-I-use-Mollie-s-services-in-my-country

### Adyen (first-party)

- https://docs.adyen.com/online-payments/psd2-sca-compliance-and-implementation-guide
- https://docs.adyen.com/online-payments/psd2-sca-compliance-and-implementation-guide/sca-options
- https://docs.adyen.com/online-payments/3d-secure-for-regulation-compliance
- https://docs.adyen.com/online-payments/tokenization/create-tokens
- https://docs.adyen.com/online-payments/tokenization/make-token-payments
- https://docs.adyen.com/get-started-with-adyen/application-requirements
- https://docs.adyen.com/development-resources/webhooks/webhook-types
- https://docs.adyen.com/development-resources/webhooks/configure-and-manage
- https://docs.adyen.com/development-resources/webhooks/secure-webhooks/verify-hmac-signatures
- https://docs.adyen.com/api-explorer/Tokenization-webhooks/latest/post/recurring.token.created
- https://docs.adyen.com/reporting/invoice-reconciliation/payment-processing-invoice
- https://docs.adyen.com/marketplaces/onboard-users/
- https://docs.adyen.com/platforms.md
- https://docs.adyen.com/online-payments/build-your-integration/sessions-flow
- https://docs.adyen.com/payment-methods/sepa-direct-debit/web-drop-in
- https://www.adyen.com/pricing
- https://help.adyen.com/knowledge/account/account-settings/how-do-i-add-a-merchant-account
