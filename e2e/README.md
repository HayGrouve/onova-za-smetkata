# E2E tests

Playwright covers **3 critical-path** browser flows (session conflict, claim-search drawer, combined-pay banner timing). Tests need a **working dev auth** setup on Convex.

Run these locally before merge when you touch guest/host browser flows. In CI, the `e2e` job runs only when the repo secret `E2E_VITE_CONVEX_URL` is set; otherwise it is skipped. A **required PR gate** is deferred — see `docs/research/e2e-implementation-scope.md` Phase 2 when that changes.

## Prerequisites

1. **Chromium** (once):

   ```bash
   pnpm run test:e2e:install
   ```

2. **Convex dev backend** (terminal 1):

   ```bash
   npx convex dev
   ```

   Use a dev Convex deployment with `DEV_MODE=true` in the Convex Dashboard (not production). Dev auth is allowed only on deployments in the dev allowlist (see `convex/lib/devMode.ts`).

3. **Convex env** on that dev deployment (Dashboard → Settings → Environment):

   ```
   DEV_MODE=true
   ```

   This enables the Password provider used by auto sign-in during `pnpm run dev`.

4. **Frontend env** in `.env.local`:

   ```
   VITE_CONVEX_URL=https://<your-dev-deployment>.convex.cloud
   ```

5. **Run tests** (terminal 2):
   ```bash
   pnpm run test:e2e
   ```
   Playwright starts `pnpm run dev` unless port 3000 is already in use.

## Specs

| File                             | Journey                                              |
| -------------------------------- | ---------------------------------------------------- |
| `session-conflict.spec.ts`       | Two browsers claim the same guest seat               |
| `claim-search-drawer.spec.ts`    | Vaul drawer + item search on guest claim             |
| `combined-guest-payment.spec.ts` | Host payment banner appears only after Revolut opens |

## Common failures

| Symptom                                      | Cause                                 | Fix                                                          |
| -------------------------------------------- | ------------------------------------- | ------------------------------------------------------------ |
| `Provider password is not configured`        | `DEV_MODE` missing or prod Convex URL | Set `DEV_MODE=true` on dev deployment; fix `VITE_CONVEX_URL` |
| Stuck on „Зареждане…“ then timeout           | Same as above                         | Same                                                         |
| `Executable doesn't exist` (webkit/chromium) | Browsers not installed                | `pnpm run test:e2e:install`                                  |
