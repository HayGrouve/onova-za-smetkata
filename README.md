# Онова за сметката

Mobile web PWA for splitting restaurant bills in Bulgarian. Create bills, assign items to participants, scan receipts with OCR, track payments, and share totals.

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in Convex values
npx convex dev               # terminal 1
pnpm run dev                 # terminal 2 — http://localhost:3000
```

Local dev auth requires `DEV_MODE=true` on your **Convex dev deployment** (via Dashboard or `npx convex env set DEV_MODE true`). Never enable on production.

## Testing

```bash
pnpm run test          # unit tests (Vitest)
pnpm run test:e2e      # Playwright — see e2e/README.md (needs convex dev + DEV_MODE)
pnpm run preflight     # test + PWA icons + production build
pnpm run check         # Prettier
pnpm run lint          # ESLint
```

## Deploy

See [docs/DEPLOY.md](docs/DEPLOY.md) for the full release checklist, security notes, and smoke tests.

Production launch spec: [docs/superpowers/specs/2026-07-08-production-launch-design.md](docs/superpowers/specs/2026-07-08-production-launch-design.md)

Quick release:

```bash
pnpm run preflight
pnpm run deploy        # Convex deploy (frontend via Vercel Git integration)
```

## Tech stack

- [TanStack Start](https://tanstack.com/start) + React 19
- [Convex](https://convex.dev) backend
- [Vercel](https://vercel.com) hosting
- [Shadcn UI](https://ui.shadcn.com) + Tailwind CSS
- [Playwright](https://playwright.dev) E2E
- [Sentry](https://sentry.io) (optional, production)
