# Production Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app production-ready for Netlify + Convex prod: verified build, env validation, PWA icons, error handling, and deploy documentation.

**Architecture:** TanStack Start builds to `dist/client` on Netlify with `VITE_CONVEX_URL` at build time. Convex prod holds backend + Gemini OCR secrets. Local `npm run preflight` gates releases. No CI, no auth.

**Tech Stack:** TanStack Start, Vite 8, Netlify, Convex, Vitest, Shadcn

**Spec:** `docs/superpowers/specs/2026-07-07-production-deploy-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `netlify.toml` | Build command, publish dir, Node version |
| `vite.config.ts` | Dev-only TanStack devtools plugin |
| `package.json` | `preflight` script |
| `src/lib/env.ts` | Build-time + runtime Convex URL helpers |
| `src/lib/env.test.ts` | Tests for env helpers |
| `src/integrations/convex/provider.tsx` | Env validation import; missing-URL fallback UI |
| `src/routes/__root.tsx` | Root error boundary; apple-touch-icon link |
| `src/routes/index.tsx` | createBill error toast |
| `src/routes/bills/$billId/summary.tsx` | finalize/delete error toasts |
| `src/components/bills/bill-card.tsx` | delete error toast |
| `scripts/generate-pwa-icons.mjs` | Generate PNG icons from SVG |
| `public/icon.svg` | Source vector for icons |
| `public/icon-192.png` | PWA icon |
| `public/icon-512.png` | PWA icon |
| `public/apple-touch-icon.png` | iOS home screen |
| `public/manifest.json` | Updated icon entries |
| `.env.example` | Netlify vs Convex env documentation |
| `README.md` | Project-specific readme |
| `docs/DEPLOY.md` | Deploy runbook + smoke test |

---

### Task 1: Netlify build config and preflight script

**Files:**
- Modify: `netlify.toml`
- Modify: `package.json`
- Modify: `vite.config.ts`

- [ ] **Step 1: Update `netlify.toml`**

Replace entire file:

```toml
[build]
  command = "npm run build"
  publish = "dist/client"

[build.environment]
  NODE_VERSION = "22"

[dev]
  command = "npm run dev"
  targetPort = 3000
  port = 8888
```

- [ ] **Step 2: Add preflight script to `package.json`**

In `"scripts"`, add:

```json
"preflight": "npm run test && npm run build"
```

- [ ] **Step 3: Load devtools plugin only in dev**

Replace `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import netlify from '@netlify/vite-plugin-tanstack-start'

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    ...(command === 'serve' ? [devtools()] : []),
    netlify(),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
}))
```

- [ ] **Step 4: Verify dev still starts**

Run: `npm run dev` (stop after confirming no errors)

- [ ] **Step 5: Commit**

```bash
git add netlify.toml package.json vite.config.ts
git commit -m "Configure Netlify build and dev-only Vite devtools."
```

---

### Task 2: Environment validation

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/env.test.ts`
- Modify: `src/integrations/convex/provider.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/lib/env.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { getConvexUrl, validateConvexUrlForBuild } from './env'

describe('getConvexUrl', () => {
  it('returns trimmed url when set', () => {
    expect(getConvexUrl('https://example.convex.cloud')).toBe(
      'https://example.convex.cloud',
    )
  })

  it('returns undefined for empty values', () => {
    expect(getConvexUrl(undefined)).toBeUndefined()
    expect(getConvexUrl('  ')).toBeUndefined()
  })
})

describe('validateConvexUrlForBuild', () => {
  it('throws in production when url missing', () => {
    expect(() =>
      validateConvexUrlForBuild({
        prod: true,
        convexUrl: undefined,
      }),
    ).toThrow('VITE_CONVEX_URL')
  })

  it('does not throw in development when url missing', () => {
    expect(() =>
      validateConvexUrlForBuild({
        prod: false,
        convexUrl: undefined,
      }),
    ).not.toThrow()
  })

  it('does not throw in production when url present', () => {
    expect(() =>
      validateConvexUrlForBuild({
        prod: true,
        convexUrl: 'https://example.convex.cloud',
      }),
    ).not.toThrow()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/lib/env.test.ts`
Expected: FAIL — module `./env` not found

- [ ] **Step 3: Implement `src/lib/env.ts`**

```typescript
export function getConvexUrl(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim()
  return trimmed || undefined
}

export function validateConvexUrlForBuild(options: {
  prod: boolean
  convexUrl: string | undefined
}): void {
  if (options.prod && !options.convexUrl) {
    throw new Error(
      'Missing VITE_CONVEX_URL. Set it in Netlify environment variables before building for production.',
    )
  }
}

/** Call at module load so production builds fail without Convex URL. */
export function assertConvexUrlForBuild(): string | undefined {
  const convexUrl = getConvexUrl(import.meta.env.VITE_CONVEX_URL)
  validateConvexUrlForBuild({
    prod: import.meta.env.PROD,
    convexUrl,
  })
  return convexUrl
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/lib/env.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Wire into Convex provider**

Replace `src/integrations/convex/provider.tsx`:

```typescript
import { ConvexProvider } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { assertConvexUrlForBuild } from '#/lib/env.ts'

const convexUrl = assertConvexUrlForBuild()

const convexQueryClient = convexUrl
  ? new ConvexQueryClient(convexUrl)
  : null

function MissingConvexConfig() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4 text-center">
      <p className="text-sm text-muted-foreground">
        Липсва конфигурация на сървъра (VITE_CONVEX_URL).
      </p>
    </div>
  )
}

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  if (!convexQueryClient) {
    return <MissingConvexConfig />
  }

  return (
    <ConvexProvider client={convexQueryClient.convexClient}>
      {children}
    </ConvexProvider>
  )
}
```

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/lib/env.ts src/lib/env.test.ts src/integrations/convex/provider.tsx
git commit -m "Validate VITE_CONVEX_URL at build time and show fallback UI."
```

---

### Task 3: Root error boundary

**Files:**
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Add error component and apple-touch-icon link**

Add imports at top:

```typescript
import type { ErrorComponentProps } from '@tanstack/react-router'
import { Button } from '#/components/ui/button.tsx'
```

Add before `export const Route`:

```typescript
function RootError({ error }: ErrorComponentProps) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <div>
        <h1 className="text-lg font-semibold">Нещо се обърка</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Опитайте да презаредите страницата.
        </p>
        {import.meta.env.DEV && error instanceof Error ? (
          <p className="mt-3 text-left text-xs text-destructive">{error.message}</p>
        ) : null}
      </div>
      <Button type="button" className="h-11" onClick={() => window.location.reload()}>
        Опитай отново
      </Button>
    </div>
  )
}
```

Update `createRootRoute({` to include:

```typescript
errorComponent: RootError,
```

In `head: () => ({ links: [...] })`, add after manifest link:

```typescript
{
  rel: 'apple-touch-icon',
  href: '/apple-touch-icon.png',
},
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "Add root error boundary and apple-touch-icon link."
```

---

### Task 4: Mutation error toasts

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/bills/$billId/summary.tsx`
- Modify: `src/components/bills/bill-card.tsx`

- [ ] **Step 1: Add toast import and catch to home create bill**

In `src/routes/index.tsx`, add:

```typescript
import { toast } from 'sonner'
```

Replace `handleCreateBill`:

```typescript
async function handleCreateBill() {
  setIsCreating(true)
  try {
    const billId = await createBill()
    await navigate({ to: '/bills/$billId', params: { billId } })
  } catch {
    toast.error('Неуспешно създаване на сметка')
  } finally {
    setIsCreating(false)
  }
}
```

- [ ] **Step 2: Add catch blocks on summary finalize/delete**

In `src/routes/bills/$billId/summary.tsx`, update handlers:

```typescript
async function handleFinalize() {
  setIsFinalizing(true)
  try {
    await finalizeBill({ billId })
    toast.success('Сметката е завършена')
  } catch {
    toast.error('Неуспешно завършване на сметката')
  } finally {
    setIsFinalizing(false)
  }
}

async function handleDelete() {
  setIsDeleting(true)
  try {
    await removeBill({ billId })
    await navigate({ to: '/' })
  } catch {
    toast.error('Неуспешно изтриване на сметката')
  } finally {
    setIsDeleting(false)
  }
}
```

- [ ] **Step 3: Add catch block on home bill card delete**

In `src/components/bills/bill-card.tsx`, add:

```typescript
import { toast } from 'sonner'
```

Replace `handleDelete`:

```typescript
async function handleDelete() {
  setIsDeleting(true)
  try {
    await removeBill({ billId: bill._id })
    setDeleteOpen(false)
  } catch {
    toast.error('Неуспешно изтриване на сметката')
  } finally {
    setIsDeleting(false)
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx src/routes/bills/\$billId/summary.tsx src/components/bills/bill-card.tsx
git commit -m "Show toast errors when bill mutations fail."
```

---

### Task 5: PWA icons and manifest

**Files:**
- Create: `public/icon.svg`
- Create: `scripts/generate-pwa-icons.mjs`
- Modify: `package.json` (add sharp devDependency + generate-icons script)
- Modify: `public/manifest.json`

- [ ] **Step 1: Install sharp for icon generation**

Run: `npm install --save-dev sharp`

- [ ] **Step 2: Create source SVG**

Create `public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#f3faf5"/>
  <rect x="48" y="48" width="416" height="416" rx="88" fill="#4fb8b2" opacity="0.18"/>
  <text x="256" y="300" text-anchor="middle" font-family="Manrope, Arial, sans-serif" font-size="220" font-weight="700" fill="#173a40">С</text>
</svg>
```

- [ ] **Step 3: Create generation script**

Create `scripts/generate-pwa-icons.mjs`:

```javascript
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(join(root, 'public/icon.svg'))

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  const png = await sharp(svg).resize(size, size).png().toBuffer()
  writeFileSync(join(root, 'public', name), png)
  console.log(`Wrote public/${name}`)
}
```

Add to `package.json` scripts:

```json
"generate-icons": "node scripts/generate-pwa-icons.mjs"
```

- [ ] **Step 4: Generate PNG files**

Run: `npm run generate-icons`
Expected: `Wrote public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`

- [ ] **Step 5: Update manifest**

Replace `public/manifest.json`:

```json
{
  "short_name": "Сметка",
  "name": "Онова за сметката",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#0f172a",
  "background_color": "#f3faf5"
}
```

- [ ] **Step 6: Commit**

```bash
git add public/icon.svg public/icon-192.png public/icon-512.png public/apple-touch-icon.png public/manifest.json scripts/generate-pwa-icons.mjs package.json package-lock.json
git commit -m "Add branded PWA icons and update web manifest."
```

---

### Task 6: Environment example and documentation

**Files:**
- Modify: `.env.example`
- Replace: `README.md`
- Create: `docs/DEPLOY.md`

- [ ] **Step 1: Update `.env.example`**

```bash
# ── Local development (.env.local) ──────────────────────────────
CONVEX_DEPLOYMENT=your-deployment-name
VITE_CONVEX_URL=https://your-deployment.convex.cloud

# ── Convex Dashboard → Settings → Environment Variables ─────────
# Required for receipt OCR:
# GEMINI_API_KEY=your-google-ai-key
# Optional model override:
# GEMINI_MODEL=gemini-2.5-flash

# ── Netlify → Site settings → Environment variables ─────────────
# Required for production frontend build:
# VITE_CONVEX_URL=https://your-prod-deployment.convex.cloud
```

- [ ] **Step 2: Replace README.md**

```markdown
# Онова за сметката

Mobile web PWA for splitting restaurant bills in Bulgarian. Create bills, assign items to participants, scan receipts with OCR, track payments, and share totals.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Convex values
npx convex dev               # terminal 1
npm run dev                  # terminal 2 — http://localhost:3000
```

## Testing

```bash
npm test
```

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full release checklist.

Quick release:

```bash
npm run preflight
npx convex deploy             # with CONVEX_DEPLOYMENT pointing at prod
git push origin main          # triggers Netlify build
```

## Tech stack

- [TanStack Start](https://tanstack.com/start) + React
- [Convex](https://convex.dev) backend
- [Netlify](https://netlify.com) hosting
- [Shadcn UI](https://ui.shadcn.com) + Tailwind CSS
```

- [ ] **Step 3: Create `docs/DEPLOY.md`**

```markdown
# Deploy Runbook

## Prerequisites (one-time)

- [ ] GitHub repo connected to Netlify
- [ ] Convex **production** deployment exists
- [ ] Netlify env: `VITE_CONVEX_URL` = prod Convex cloud URL
- [ ] Convex prod env: `GEMINI_API_KEY` (for receipt OCR)

## Environment variables

| Variable | Where | Required |
|----------|-------|----------|
| `VITE_CONVEX_URL` | Netlify | Yes |
| `GEMINI_API_KEY` | Convex Dashboard | Yes (for OCR) |
| `GEMINI_MODEL` | Convex Dashboard | No |
| `CONVEX_DEPLOYMENT` | Local `.env.local` | Yes (for CLI) |

Never put `GEMINI_API_KEY` in Netlify or the repo.

## Release steps

1. **Preflight locally**

   ```bash
   npm run preflight
   ```

   Requires `VITE_CONVEX_URL` in environment (or `.env.local`).

2. **Deploy Convex backend**

   ```bash
   npx convex deploy
   ```

   Ensure `CONVEX_DEPLOYMENT` in `.env.local` targets **production**.

3. **Deploy frontend**

   Push to `main`. Netlify runs `npm run build` and publishes `dist/client`.

4. **Smoke test** (production URL)

   - [ ] Home loads; bills list appears
   - [ ] Create bill → add participant → add item → assign
   - [ ] Summary page; finalize with restaurant name
   - [ ] Mark participant paid
   - [ ] Payment settings (Revolut/IBAN) persist after reload
   - [ ] Receipt OCR scan (if Gemini key set)
   - [ ] Add to Home Screen shows branded icon
   - [ ] No devtools panel visible
   - [ ] Summary bottom buttons not clipped on mobile

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Blank page / config message | Missing `VITE_CONVEX_URL` on Netlify | Set env var; redeploy |
| Build fails on Netlify | Same | Set `VITE_CONVEX_URL` in Netlify build env |
| OCR always fails | Missing `GEMINI_API_KEY` in Convex prod | Set in Convex Dashboard |
| Data from wrong environment | Dev Convex URL in Netlify | Point Netlify at prod URL |
```

- [ ] **Step 4: Commit**

```bash
git add .env.example README.md docs/DEPLOY.md
git commit -m "Add deploy runbook and project-specific README."
```

---

### Task 7: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run preflight with Convex URL set**

Run: `npm run preflight`
Expected: all tests pass; `vite build` succeeds

If build fails with missing `VITE_CONVEX_URL`, ensure `.env.local` contains it (Vite loads env files automatically).

- [ ] **Step 2: Verify production bundle excludes devtools**

Run: `grep -r "TanStackDevtools" dist/client/assets/ || echo "OK: no devtools in client bundle"`
Expected: `OK: no devtools in client bundle` (or no matches)

- [ ] **Step 3: Manual dev smoke test**

Run: `npm run dev`
Check: app loads, no console errors about missing Convex URL

- [ ] **Step 4: Final commit if any fixups needed**

Only if verification required small fixes.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| netlify.toml + NODE_VERSION | Task 1 |
| Dev-only vite devtools | Task 1 |
| preflight script | Task 1 |
| Build-time env validation | Task 2 |
| Convex provider fallback UI | Task 2 |
| Root error boundary | Task 3 |
| apple-touch-icon link | Task 3 |
| Mutation error toasts | Task 4 |
| PWA icons 192/512/apple | Task 5 |
| manifest.json update | Task 5 |
| .env.example update | Task 6 |
| README rewrite | Task 6 |
| docs/DEPLOY.md | Task 6 |
| Post-deploy smoke test documented | Task 6 |
| npm run preflight verification | Task 7 |

## Out of scope (do not implement)

- CI/CD, auth, noindex, service worker, Sentry, custom domain setup
