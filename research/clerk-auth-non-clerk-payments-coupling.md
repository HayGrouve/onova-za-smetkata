# Research: Clerk auth beside a non-Clerk payments stack

> **Decision:** Keep Clerk for Host auth; Host Pro is Stripe Billing — [ADR 0003](../docs/adr/0003-stripe-billing-beside-clerk.md).

Part of wayfinder map [#132](https://github.com/HayGrouve/onova-za-smetkata/issues/132). Resolves [#136](https://github.com/HayGrouve/onova-za-smetkata/issues/136).

## Question

Is it **reasonable to keep Clerk for Host auth** and move **all payments off Clerk Billing**?

Map the coupling: Clerk user id ↔ payment-customer id ↔ Convex `users` row; checkout session creation (TanStack Start vs Convex actions); webhook verification; Clerk Billing APIs already in this repo; whether Clerk documents or forbids splitting auth and billing; migration cost off Clerk Billing without touching sign-in.

## Verdict

**Yes.** Keep Clerk for Host authentication. Move SaaS payments to a processor that supports EUR and SCA/3DS (Stripe Billing, a merchant of record, or an EU PSP — vendor choice is out of scope here). Clerk does **not** require Clerk Billing for sessions, JWT, or Convex. This repo already treats Convex as the quota source of truth; Clerk Billing is a thin, incomplete checkout/webhook mirror.

**Conditions (implementation, not blockers):**

1. **Disable Clerk Billing** in the Clerk Dashboard (or never enable it in production) so `<UserProfile />` / `openUserProfile()` does not surface Clerk Plans. Clerk documents that user Plans appear in `UserProfile` when Billing is on ([B2C Billing](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c)).
2. **Store the PSP customer id on Convex `users`**, keyed by existing `clerkSubject` / `Id<'users'>`. Do not treat Clerk `publicMetadata` as authoritative ([Approach B](./auth-billing-alternatives.md)).
3. **Keep `getEffectiveTier` in Convex.** Do not start using Clerk JWT `pla`/`fea` / `has({ plan })` for mutation guards (already the locked split in the implementation spec and [#104](https://github.com/HayGrouve/onova-za-smetkata/issues/104)).
4. **Create checkout/portal sessions on the server** (Convex `"use node"` action, or a TanStack Start server function with the PSP secret). Clerk Billing’s client `startCheckout` is not a model to copy.

---

## Does Clerk document or forbid splitting auth and billing?

**Neither forbids nor requires Billing for auth.** First-party docs treat them as separate products:

| Claim                                                                                                                                                                                                  | Source                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth quickstart for TanStack Start is `ClerkProvider`, `clerkMiddleware()`, env keys — **no Billing step**                                                                                             | [TanStack Start quickstart](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart)                                           |
| Billing is an **optional** Dashboard product: enable via Billing Settings / `npx clerk@latest enable billing --for users`                                                                              | [B2C Billing](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c)                                                             |
| “Clerk Billing is a **separate product** from Stripe Billing; Plans and Subscriptions made in Clerk are **not synced** to Stripe.” Stripe is used **only for payment processing** inside Clerk Billing | [Billing overview FAQ](https://clerk.com/docs/guides/billing/overview)                                                                        |
| Convex integration is **JWT issuer + `ConvexProviderWithClerk` + `ctx.auth.getUserIdentity()`**. No Billing, no Stripe customer                                                                        | [Clerk ↔ Convex](https://clerk.com/docs/guides/development/integrations/databases/convex), [Convex Clerk](https://docs.convex.dev/auth/clerk) |
| Plan gating (`has({ plan })`, `<Show when={{ plan }}>`, `<PricingTable />`) exists **only after Billing is enabled**                                                                                   | [B2C Billing](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c)                                                             |

Clerk **does** document that Clerk Billing ≠ Stripe Billing and that you cannot see Clerk subscriptions as Stripe Billing objects. That is an argument **against** staying on Clerk Billing if you need EUR/3DS/VAT — already recorded in [`clerk-billing-platform-constraints.md`](./clerk-billing-platform-constraints.md) — not an argument that auth and payments must stay together.

No Clerk or Convex first-party page found that says “you may not use Clerk sessions with an external subscription provider.” Convex HTTP actions are the documented place to receive **any** vendor webhook ([HTTP actions](https://docs.convex.dev/functions/http-actions)).

---

## Identity coupling (this codebase)

There is **no payment-customer id today**. The chain is two hops, not three:

```
Clerk user id (JWT `sub` / webhook `payer.user_id`)
    → users.clerkSubject  (index by_clerkSubject)
    → Id<'users'>         (bills.ownerId, quotas, friend groups)
```

| Hop                                  | Where                                                                                                                        | Notes                                                                                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clerk session → Convex JWT           | `convex/auth.config.ts` (`CLERK_JWT_ISSUER_DOMAIN`, `applicationID: 'convex'`); client `ConvexProviderWithClerk` + `useAuth` | Auth-only. Required to keep.                                                                                                                                                                          |
| JWT `identity.subject` → `users` row | `convex/lib/auth.ts` `requireAuth` upsert; `users.ensureCurrent` on sign-in                                                  | Default `clerkPlanSlug: 'free_user'` is a **billing default**, not an auth requirement.                                                                                                               |
| Clerk Billing payer → same row       | `convex/clerkWebhookAction.ts` reads `event.data.payer.user_id` as `clerkSubject`                                            | This is the **only** payment identity link. PSP webhooks should look up the same row via stored `stripeCustomerId` (or equivalent) **or** Clerk user id in Checkout `client_reference_id` / metadata. |

**Target chain after leaving Clerk Billing** (Approach B in [`auth-billing-alternatives.md`](./auth-billing-alternatives.md)):

```
Clerk user id  →  users.clerkSubject  →  Id<'users'>
                                        ↘ users.{psp}CustomerId  →  Stripe/Paddle/… customer
```

Checkout metadata should include `users._id` or `clerkSubject` so the first webhook can attach the customer id even if the Host never completed a prior mapping.

---

## Checkout: TanStack Start vs Convex

**Today: neither.** This app does not create Clerk or Stripe checkout sessions.

| Surface                                          | What the spec asked                                                                         | What the code does                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Paywall                                          | `<PricingTable />` or `clerk.billing.startCheckout({ planId: 'pro', planPeriod: 'month' })` | `SubscriptionProvider` → `openUserProfile()` |
| Profile “Управление на абонамента”               | `<SubscriptionDetailsButton />`                                                             | `openUserProfile()`                          |
| Clerk `has({ plan \| feature })` / `<Show when>` | Optional UX gates                                                                           | **Not used** in `src/`                       |

Clerk’s documented checkout is **client-side** (`clerk.billing.startCheckout` / `useCheckout` / `<PricingTable />`) and stays inside Clerk Billing ([billing object](https://clerk.com/docs/reference/objects/billing), [B2C guide](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c)). That path disappears with Clerk Billing.

**Recommended replacement (same as Approach B):** a Convex **`"use node"` action** (or HTTP-authenticated action) that:

1. `requireAuth` → `Id<'users'>`
2. Ensures PSP customer (create-or-get, persist id on `users`)
3. Creates Checkout Session (`mode: 'subscription'`) or Customer Portal session
4. Returns the URL to the PWA

Convex HTTP actions **cannot** use Node APIs; they must `runAction` a Node action — the same pattern as current Svix verify in `clerkWebhookAction.ts` ([HTTP actions limits](https://docs.convex.dev/functions/http-actions#limits)). Putting the PSP secret on Convex (not the Vite bundle) matches existing `CLERK_WEBHOOK_SIGNING_SECRET` placement.

A TanStack Start server function on Vercel could also create sessions (`CLERK_SECRET_KEY` already lives there for `clerkMiddleware`). That splits billing secrets across Vercel + Convex. Prefer **Convex** so webhook + customer row + checkout share one backend.

---

## Webhook verification (today vs after)

**Today (Clerk Billing → Convex):**

1. Clerk Dashboard → `POST https://<deployment>.convex.site/clerk/webhook`
2. `convex/http.ts` reads Svix headers (`svix-id`, `svix-timestamp`, `svix-signature`)
3. Node action `Webhook` from `svix` + `CLERK_WEBHOOK_SIGNING_SECRET` ([Clerk webhooks](https://clerk.com/docs/guides/development/webhooks/overview) — Clerk uses Svix)
4. `internal.clerkWebhooks.applyBillingEvent` — idempotent via `processedWebhookEvents`

Handled types: `subscriptionItem.active`, `.canceled`, `.pastDue`, `subscription.updated` (inactive → `free_user`). Missing vs Clerk catalog: `subscriptionItem.updated` ([audit](./clerk-billing-integration-audit.md)).

**After:** same HTTP-action + Node-verify + idempotent mutation pattern; **different** secret, headers, and event names (e.g. Stripe `Stripe-Signature` + `constructEvent`). Keep `processedWebhookEvents`. Map events onto existing `subscriptionStatus` / `currentPeriodEnd` / `graceUntil` so `hostTier.ts` stays.

Optional: keep a **separate** Clerk webhook for `user.created|updated|deleted` (Convex documents this for DB sync). This repo does **not** subscribe to user lifecycle events; Host rows are created by `requireAuth`. User-sync webhooks are optional, not required to leave Billing.

---

## Clerk Billing APIs this repo actually uses

| API / component                     | In spec / ADR 0002 | In `src/` / `convex/`                                                             |
| ----------------------------------- | ------------------ | --------------------------------------------------------------------------------- |
| `ClerkProvider` + `clerkMiddleware` | Yes (auth)         | **Keep** — `provider.tsx`, `src/start.ts`                                         |
| `ConvexProviderWithClerk`           | Yes (auth)         | **Keep**                                                                          |
| `<SignIn />`                        | Yes                | **Keep** — `login.tsx`                                                            |
| `openUserProfile()`                 | Workaround         | Paywall + profile — **retarget** to PSP portal / pricing                          |
| `SubscriptionProvider`              | Custom             | **Keep the paywall shell**; drop Clerk billing call                               |
| `<PricingTable />`                  | Spec Phase 3       | **Not wired**                                                                     |
| `<SubscriptionDetailsButton />`     | Spec Phase 3       | **Not wired**                                                                     |
| `clerk.billing.startCheckout`       | Spec Phase 3       | **Not wired**                                                                     |
| `has()` / `<Show when={{ plan }}>`  | Spec optional UX   | **Not wired**                                                                     |
| Billing webhooks                    | Spec + ADR env     | **Rip** — `http.ts` `/clerk/webhook`, `clerkWebhookAction.ts`, `clerkWebhooks.ts` |
| `clerkPlanSlug` mirror              | Spec               | **Rename or keep as opaque slug**; stop writing Clerk plan names                  |

ADR 0002 currently bundles “Clerk — sign-in UI, user profile, **checkout, subscription lifecycle**.” Auth half stays; billing half of that sentence is what this map supersedes.

Implementation spec already splits: **Clerk gates plan tier only; Convex is authoritative for quotas.** Moving the plan-tier source from Clerk webhooks to PSP webhooks does not change `hostTier` guards on `bills.create`, `receiptScan.startScan`, `friendGroups.create`.

---

## Rip vs keep

### Keep (Host auth — do not touch for this migration)

- Packages: `@clerk/tanstack-react-start`, `@clerk/localizations`, `@clerk/testing`
- `ClerkProvider`, `ConvexProviderWithClerk`, `EnsureConvexUser` / `users.ensureCurrent`
- `src/start.ts` `clerkMiddleware()`, `CLERK_SECRET_KEY` on Vercel
- `convex/auth.config.ts`, `CLERK_JWT_ISSUER_DOMAIN` on Convex
- `convex/lib/auth.ts` `clerkSubject` mapping, `requireAuth` / `requireBillOwner`
- `/login` `<SignIn />`, header sign-out, `useRequireHostAuth`
- E2E Clerk Testing Tokens
- Guest flows (share tokens) — unrelated

### Rip / replace (payments only)

- Dashboard: Clerk Billing plans (`free_user` / `pro`), Stripe-via-Clerk gateway, billing webhook subscription
- Env: `CLERK_WEBHOOK_SIGNING_SECRET` (unless reused for optional `user.*` sync)
- `convex/http.ts` `/clerk/webhook` → PSP route
- `convex/clerkWebhookAction.ts`, `convex/clerkWebhooks.ts`
- Paywall/profile `openUserProfile()` as **subscription** entry
- Docs that say Clerk owns checkout: ADR 0002 billing bullet, spec Phase 3, `docs/clerk-production-setup.md` billing phases, `DEPLOY.md` webhook row
- Default `clerkPlanSlug: 'free_user'` naming (free tier remains a Convex default)

### Keep and retarget (already Convex-owned)

- `convex/lib/hostTier.ts` + tests, monthly counters, `QUOTA_*` messages
- `users.viewer` usage payload
- `SubscriptionProvider` / `QuotaPaywallSheet` (swap `onUpgrade`)
- `processedWebhookEvents` table

---

## Estimated migration surface (auth frozen)

Auth migration **already landed**. Remaining work is Approach B’s **billing-only** slice from [`auth-billing-alternatives.md`](./auth-billing-alternatives.md): then **Large + Medium**; now **Medium**.

| Workstream                                               | Size | Notes                                              |
| -------------------------------------------------------- | ---- | -------------------------------------------------- |
| Schema: PSP customer id (+ maybe rename `clerkPlanSlug`) | S    | No `ownerId` remap                                 |
| Convex Node action: checkout + portal sessions           | S–M  | New secrets on Convex                              |
| HTTP webhook + map onto `hostTier` fields                | M    | Replace Clerk event names; keep grace rules (#112) |
| Paywall + profile CTAs                                   | S    | Custom UI; no Clerk `PricingTable`                 |
| Dashboard: disable Clerk Billing; configure PSP          | S    | Ops                                                |
| E2E billing smoke                                        | M    | Auth E2E unchanged                                 |
| Docs / ADR 0002 amendment                                | S    | Record split: Clerk auth, PSP billing              |

**Not in this surface:** login, Clerk JWT, guest join/claim, quota numbers (#107).

**Live subscribers:** spec Phase 5 still treats pre-public wipe as acceptable. If any Host already paid via Clerk Billing, that is **not** portable to Stripe Billing (Clerk FAQ: subscriptions are not synced). Cancel/refund in Stripe + re-subscribe on the new stack, or stay pre-public with no prod Clerk Billing customers.

---

## Alignment with prior research

- **Approach B** (Clerk auth + Stripe Billing) is the architectural template. Auth cost is **sunk**. Billing cost remains custom checkout + webhooks.
- **Approach A** (Clerk Billing) is the current ADR 0002 decision and is the path [#132](https://github.com/HayGrouve/onova-za-smetkata/issues/132) intends to supersede because of USD-only + no 3DS.
- Repo coupling to Clerk Billing is **weaker than the spec**: checkout APIs were never wired; enforcement already lives in Convex.

---

## Sources

### Clerk (first-party)

- [Billing overview](https://clerk.com/docs/guides/billing/overview) — separate product from Stripe Billing; USD; no 3DS; no VAT; Stripe for processing only
- [B2C Billing (TanStack Start)](https://clerk.com/docs/tanstack-react-start/guides/billing/for-b2c) — enable Billing; `PricingTable`; `has()` / `<Show>`; Plans in `UserProfile`
- [TanStack Start quickstart](https://clerk.com/docs/tanstack-react-start/getting-started/quickstart) — auth-only
- [clerkMiddleware](https://clerk.com/docs/reference/tanstack-react-start/clerk-middleware)
- [Integrate Convex with Clerk](https://clerk.com/docs/guides/development/integrations/databases/convex) — JWT / providers only
- [Webhooks overview](https://clerk.com/docs/guides/development/webhooks/overview) — Svix; `verifyWebhook` / svix libraries
- [Billing webhooks](https://clerk.com/docs/guides/development/webhooks/billing)
- [Billing JS object / `startCheckout`](https://clerk.com/docs/reference/objects/billing)

### Convex (first-party)

- [Convex + Clerk](https://docs.convex.dev/auth/clerk) — `ConvexProviderWithClerk`, JWT template `convex`
- [HTTP actions](https://docs.convex.dev/functions/http-actions) — webhooks; Node via nested actions
- [TanStack Start + Clerk](https://docs.convex.dev/client/tanstack/tanstack-start/clerk)

### This repo

- [ADR 0002](../docs/adr/0002-clerk-auth-billing.md)
- [Implementation spec](../docs/specs/clerk-auth-billing-implementation.md)
- [`research/auth-billing-alternatives.md`](./auth-billing-alternatives.md) Approach B
- [`research/clerk-billing-integration-audit.md`](./clerk-billing-integration-audit.md)
- [`research/clerk-billing-platform-constraints.md`](./clerk-billing-platform-constraints.md)
- Code: `convex/http.ts`, `convex/clerkWebhookAction.ts`, `convex/clerkWebhooks.ts`, `convex/lib/auth.ts`, `convex/lib/hostTier.ts`, `convex/schema.ts` (`users`), `src/integrations/convex/provider.tsx`, `src/components/subscription/subscription-provider.tsx`, `src/components/profile/profile-sheet.tsx`, `src/start.ts`
