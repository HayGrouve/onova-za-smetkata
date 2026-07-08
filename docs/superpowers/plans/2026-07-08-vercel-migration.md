# Vercel Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Netlify with Vercel for frontend hosting using Nitro; update docs and verify build.

**Architecture:** Remove `@netlify/vite-plugin-tanstack-start`; add `nitro({ preset: 'vercel' })` to `vite.config.ts`. Vercel auto-detects TanStack Start + Nitro. Convex backend unchanged.

**Tech Stack:** TanStack Start, Nitro, Vercel, Convex, pnpm, Vitest

**Spec:** `docs/superpowers/specs/2026-07-08-vercel-migration-design.md`

---

### Task 1: Swap build adapter (Netlify → Nitro/Vercel)

**Files:**

- Modify: `vite.config.ts`
- Modify: `package.json`
- Delete: `netlify.toml`

- [ ] **Step 1: Update `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  plugins: [
    ...(command === 'serve' ? [devtools()] : []),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: 'vercel' }),
    viteReact(),
  ],
}))
```

- [ ] **Step 2: Update `package.json` dependencies**

Remove `"@netlify/vite-plugin-tanstack-start": "^1.2.15"` from devDependencies.

Add `"nitro": "^3.0.0"` to devDependencies (or latest stable).

- [ ] **Step 3: Delete `netlify.toml`**

- [ ] **Step 4: Install and verify lockfile**

Run: `pnpm install`
Expected: lockfile updated; no Netlify plugin packages

---

### Task 2: Update env error copy

**Files:**

- Modify: `src/lib/env.ts`

- [ ] **Step 1: Change Netlify → Vercel in error message**

```ts
'Missing VITE_CONVEX_URL. Set it in Vercel environment variables before building for production.',
```

- [ ] **Step 2: Run unit tests**

Run: `pnpm run test`
Expected: PASS (tests only assert `VITE_CONVEX_URL` substring)

---

### Task 3: Update deployment docs

**Files:**

- Modify: `docs/DEPLOY.md`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `.cta.json` (optional: `netlify` → remove from chosenAddOns)

Replace all Netlify references with Vercel. Add Phase 1 (`*.vercel.app`) and Phase 2 (custom domain) cutover steps from spec.

---

### Task 4: Preflight verification

- [ ] **Step 1: Format and lint**

Run: `pnpm run check && pnpm run lint`
Expected: PASS

- [ ] **Step 2: Full preflight**

Run: `VITE_CONVEX_URL=https://coordinated-warbler-782.convex.cloud pnpm run preflight`
Expected: tests pass, PWA icons OK, production build succeeds with Nitro/Vercel output

---

### Task 5: Vercel project setup (manual, post-merge)

1. Import GitHub repo in Vercel; Node 22; pnpm.
2. Set `VITE_CONVEX_URL=https://coordinated-warbler-782.convex.cloud`.
3. Deploy; smoke test on `https://<project>.vercel.app`.
4. Phase 2: add `onova-za-smetkata.com`, clean DNS, set Convex `SITE_URL` + Vercel `VITE_APP_ORIGIN`, redeploy.
5. Decommission Netlify.
