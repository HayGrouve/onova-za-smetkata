# Performance, UX Polish & Deploy Hardening — Design

**Status:** Approved  
**Date:** 2026-07-08

## Goal

Improve perceived speed, mobile polish, and release reliability without new product features.

## Scope

### A — Performance & loading

1. **Single payment-settings subscription** via extended `PaymentSettingsProvider`
2. **Stable bill header title** — route-level context; no duplicate `bills.get` in header
3. **Skeleton loading** on home, bill editor, summary (replace full-page “Зареждане…” for data)
4. **Lighter `listWithSummary`** — draft bills skip assignments/payments load
5. **Solid sticky surfaces on mobile** — remove `backdrop-blur` on header, sticky totals, guest footer (keep optional blur on `md+`)
6. **Dynamic import `qrcode`** in `BillInviteCard`

### C — UI/UX polish

1. Fixed-width header slots for user label and action icons
2. Visually hidden labels on search inputs (home, join, claim)
3. Summary page bottom safe-area spacer
4. Guest join disabled buttons: `aria-label` with “заето”
5. Theme toggle placeholder: `aria-label="Тема"`

### D — Ops / deploy

1. GitHub Actions: `pnpm install --frozen-lockfile` + `pnpm run preflight`
2. Netlify configured for pnpm; lockfile in sync
3. Pin TanStack `"latest"` dependencies
4. Update `docs/DEPLOY.md` and `.env.example` with auth + prod checklist
5. Remove unused `@tanstack/react-router-ssr-query` if confirmed

## Out of scope

- Bulk assign UI, SSR auth, service worker, Sentry, pagination

## Success criteria

- Skeleton instead of full-page flash on home → bill navigation
- Header title does not blink “Зареждане…” on bill refetch
- Summary actions visible above iPhone home indicator
- CI passes on PR; Netlify uses frozen pnpm lockfile

## Files (primary)

| Area            | Files                                                                             |
| --------------- | --------------------------------------------------------------------------------- |
| Payment context | `payment-settings-provider.tsx`, `payment-settings-open-button.tsx`, consumers    |
| Header          | `app-header.tsx`, new `bill-header-title.tsx`                                     |
| Skeletons       | `ui/skeleton.tsx`, `index.tsx`, `bills/$billId/index.tsx`, `summary.tsx`          |
| Backend         | `convex/bills.ts`                                                                 |
| CSS / bars      | `styles.css`, `app-header.tsx`, `sticky-totals-bar.tsx`, `guest-claim-footer.tsx` |
| Ops             | `.github/workflows/ci.yml`, `netlify.toml`, `package.json`, `docs/DEPLOY.md`      |
