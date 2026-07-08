# E2E tests

Playwright covers the host + guest split flow. Tests need a **working dev auth** setup on Convex.

## Prerequisites

1. **Chromium** (once):
   ```bash
   pnpm run test:e2e:install
   ```

2. **Convex dev backend** (terminal 1):
   ```bash
   npx convex dev
   ```
   Use a dev Convex deployment with `DEV_MODE=true` in the Convex Dashboard (not production).

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

## Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Provider password is not configured` | `DEV_MODE` missing or prod Convex URL | Set `DEV_MODE=true` on dev deployment; fix `VITE_CONVEX_URL` |
| Stuck on „Зареждане…“ then timeout | Same as above | Same |
| `Executable doesn't exist` (webkit/chromium) | Browsers not installed | `pnpm run test:e2e:install` |
