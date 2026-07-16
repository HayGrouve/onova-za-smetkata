# PWA Install Footer & Prompt Capture (Scoped Design)

**Date:** 2026-07-09  
**Status:** Approved  
**Scope:** Home page footer for authenticated hosts (not login/join/claim/bill pages)

---

## Problem

1. Install banner only appears after page refresh (visit counter + `beforeinstallprompt` race).
2. Dismissing the banner removes all install affordances permanently.
3. No site footer with useful context.

## Solution

1. **Early prompt capture** — register `beforeinstallprompt` once at app boot; store deferred prompt in a module singleton + React context.
2. **Remove 2nd-visit gate** — show home banner on first authenticated visit.
3. **Separate dismiss keys** — `pwa-banner-dismissed` hides banner only; footer install persists.
4. **`AppFooter`** on home page only with value props + install button.

## Visibility rules

| Surface     | When shown                                                                   |
| ----------- | ---------------------------------------------------------------------------- |
| Home banner | Home, authenticated, not standalone, banner not dismissed, install available |
| Footer      | Home (`/`) only, authenticated, not standalone, install available            |

Hide both when `isStandalonePwa()`.

## Footer content

- Site name: „Онова за сметката“
- Three value-prop bullets (receipt OCR, guest QR, Revolut/IBAN)
- Install button (native prompt or iOS inline steps)

## Files

| File                                      | Action                   |
| ----------------------------------------- | ------------------------ |
| `src/lib/pwa-install-prompt.ts`           | New — singleton capture  |
| `src/lib/pwa-install-routes.ts`           | New — `isHostShellRoute` |
| `src/components/pwa-install-provider.tsx` | New — context            |
| `src/components/layout/app-footer.tsx`    | New                      |
| `src/components/pwa-install-banner.tsx`   | Refactor                 |
| `src/components/layout/app-shell.tsx`     | Footer + provider        |
| `src/lib/pwa-install.test.ts`             | Route helper tests       |

## Testing

- Unit tests for `isHostShellRoute`
- Manual: login → home without refresh → banner + footer; dismiss banner → footer install remains; guest join → no footer
