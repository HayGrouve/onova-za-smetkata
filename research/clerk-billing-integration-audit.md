# Research: Clerk Billing integration gap audit

Part of wayfinder map [#114](https://github.com/HayGrouve/onova-za-smetkata/issues/114). Resolves [#116](https://github.com/HayGrouve/onova-za-smetkata/issues/116).

## Question

What is implemented vs still required per `docs/specs/clerk-auth-billing-implementation.md` and Clerk B2C + billing webhook docs?

## Already implemented

### Auth + provider stack

- `convex/auth.config.ts`, `convex/lib/auth.ts` (`clerkSubject` upsert)
- `convex/schema.ts` — billing mirror fields + `processedWebhookEvents`
- `src/integrations/convex/provider.tsx` — `ClerkProvider` → `ConvexProviderWithClerk` → `SubscriptionProvider`
- `src/start.ts` — `clerkMiddleware()`; `src/routes/login.tsx` — Clerk `<SignIn />`

### Quota engine (Convex authoritative)

- `convex/lib/hostTier.ts` + tests — tier, grace, monthly counters
- Guards on `bills.create`, `receiptScan.startScan`, `friendGroups.create`
- `convex/users.ts` — `viewer` usage query
- `shared/subscription-messages.ts` — Bulgarian `QUOTA_*` copy

### Billing UI (partial)

- `subscription-provider.tsx`, `quota-paywall-sheet.tsx` — paywall on quota errors
- `profile-sheet.tsx` — plan label, usage, manage via `openUserProfile()`
- **Not wired:** `PricingTable`, `SubscriptionDetailsButton`, `startCheckout`, `<Show when>`

### Webhooks

- `convex/http.ts` → `clerkWebhookAction.ts` → `clerkWebhooks.ts`
- Handles: `subscriptionItem.active`, `.canceled`, `.pastDue`, `subscription.updated`
- Svix verification + idempotency

### E2E

- Clerk Testing Tokens in `e2e/helpers/host-auth.ts`, `e2e/global-setup.ts`

## Gaps vs spec

| Requirement                                     | Status                              |
| ----------------------------------------------- | ----------------------------------- |
| `<SubscriptionDetailsButton />` in profile      | Missing — uses `openUserProfile()`  |
| Paywall → `<PricingTable />` or `startCheckout` | Missing — opens user profile        |
| `<Show when={{ plan: 'pro' }}>` on OCR / groups | Missing — mutation-only enforcement |
| E2E billing upgrade flow                        | Missing                             |
| `subscriptionItem.updated` webhook              | Missing handler + subscription      |

## Gaps vs Clerk B2C docs

- No `has({ plan \| feature })` in `src/`
- No `clerk.session.reload()` after checkout
- No `@clerk/backend` reconciliation on Convex (optional)

## Dashboard / ops (cannot verify from code)

See checklist in `docs/clerk-production-setup.md` Phases 1.7, 3, 4 — billing enabled, plans, prod Stripe, webhook URL + secret, smoke test billing block.

## Recommended priority

1. Dashboard ops + webhook delivery verification (#119)
2. `subscriptionItem.updated` handler
3. Clerk billing UI (`startCheckout` / `PricingTable`, `SubscriptionDetailsButton`)
4. Optional `<Show>` UX gates
5. E2E billing smoke + webhook tests
6. Docs hygiene (README `DEV_MODE` auth lines stale)

## Bottom line

Backend architecture matches locked #103/#104 decisions. Largest **code** gaps: Clerk-native checkout/manage components and `subscriptionItem.updated`. Largest **overall** gap: prod dashboard configuration.
