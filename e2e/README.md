# E2E tests

Playwright covers the critical browser journeys: guest claiming by count (no accidental splits), explicit sharing, Covered seats, combined-pay banner timing, session conflict, Host account, and host onboarding. Tests need **Clerk Testing Tokens** and a dev Convex deployment.

Run these locally before merge when you touch guest/host browser flows. In CI, the `e2e` job runs only when the repo secret `E2E_VITE_CONVEX_URL` is set; otherwise it is skipped.

## Prerequisites

1. **Chromium** (once):

   ```bash
   pnpm run test:e2e:install
   ```

2. **Convex dev backend** (terminal 1):

   ```bash
   npx convex dev
   ```

3. **Frontend env** in `.env.local`:

   ```
   VITE_CONVEX_URL=https://<your-dev-deployment>.convex.cloud
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   E2E_CLERK_USER_EMAIL=your+clerk_test@example.com
   ```

   `CLERK_SECRET_KEY` powers Clerk Testing Tokens (`e2e/global-setup.ts`). `E2E_CLERK_USER_EMAIL` is optional but recommended — a user in your Clerk **dev** instance used by `openHostContext`.

4. **Convex env** on that dev deployment:

   ```
   CLERK_JWT_ISSUER_DOMAIN=https://<your-instance>.clerk.accounts.dev
   ```

5. **Run tests** (terminal 2):

   ```bash
   pnpm run test:e2e
   ```

   Playwright starts `pnpm run dev` unless port 3000 is already in use.

## Specs

| File                             | Journey                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `guest-claim-by-count.spec.ts`   | Two phones press „+“ on the same drink at once — nobody ends up splitting    |
| `guest-share-unit.spec.ts`       | „Сподели“ puts half a drink on a friend right away                           |
| `guest-covered-seat.spec.ts`     | One phone claims and pays for two seats; Host confirms both                  |
| `session-conflict.spec.ts`       | Two browsers claim the same guest seat                                       |
| `combined-guest-payment.spec.ts` | Host payment banner appears only after Revolut opens                         |
| `host-account-route.spec.ts`     | Host Акаунт: unsigned redirect; `/user-profile` and `/user-profile/security` |
| `host-onboarding.spec.ts`        | Host replay hints; welcome dismiss                                           |

## Common failures

| Symptom                                 | Cause                                         | Fix                                                                                                                              |
| --------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `E2E host auth is not available`        | Clerk sign-in failed                          | Set `CLERK_SECRET_KEY`; set `E2E_CLERK_USER_EMAIL` to a dev user                                                                 |
| Missing Clerk config screen             | `VITE_CLERK_PUBLISHABLE_KEY` unset            | Add Clerk keys to `.env.local`                                                                                                   |
| Stuck on „Зареждане…“ then timeout      | Convex URL mismatch or Clerk JWT not set      | Fix `VITE_CONVEX_URL`; set `CLERK_JWT_ISSUER_DOMAIN` on Convex dev                                                               |
| „Нова сметка“ opens „Надградете до Pro“ | Test user hit the Free limit of 5 bills/month | Give the E2E user Host Pro on the **dev** deployment (`clerkPlanSlug: 'pro'`, `subscriptionStatus: 'active'` on its `users` row) |
| `Executable doesn't exist`              | Browsers not installed                        | `pnpm run test:e2e:install`                                                                                                      |
