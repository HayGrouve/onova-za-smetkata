# Dark Mode — Design Spec

**Date:** 2026-07-07  
**Project:** onova-za-smetkata  
**Status:** Approved  

## Summary

Enable dark mode across the app with **dark as the default**, and a header toggle for light / dark / system preference. Reuse existing `.dark` CSS tokens and `next-themes` (already installed).

## Decisions

| Decision | Choice |
|----------|--------|
| Default theme | Dark |
| User control | Header dropdown: Светла / Тъмна / Системна |
| Persistence | `localStorage` key `onova-theme` via `next-themes` |
| Class strategy | `attribute="class"` on `<html>` |
| Toggle placement | `AppHeader`, always visible, left of payment settings cog |

## Architecture

```
RootDocument
  ThemeProvider (defaultTheme=dark, enableSystem)
    ConvexProvider
      AppShell + Toaster
```

Sonner already uses `useTheme()` — works once provider is wired.

## CSS

- Existing `.dark { ... }` Shadcn + coastal tokens — no token redesign
- Add `.dark body`, `.dark body::before`, `.dark body::after` overrides for page gradient
- Add `color-scheme: dark` on `.dark` root
- Fix hardcoded light-only classes in receipt scan review (`dark:` variants)

## PWA

- `manifest.json`: `background_color` → `#0a1418` (matches dark `--bg-base`)
- `theme_color` stays `#0f172a`

## Components

| File | Change |
|------|--------|
| `src/components/theme-provider.tsx` | New — `next-themes` wrapper |
| `src/components/layout/theme-toggle.tsx` | New — dropdown with 3 theme options |
| `src/routes/__root.tsx` | ThemeProvider, `suppressHydrationWarning` on `<html>` |
| `src/components/layout/app-header.tsx` | Theme toggle in header |
| `src/styles.css` | Dark body gradient overrides |
| `src/components/bills/receipt-scan-review-sheet.tsx` | Dark variants for amber highlights |
| `public/manifest.json` | Dark background_color |

## Out of scope

- Convex-synced theme preference
- Dedicated settings page for theme
- Dynamic runtime `theme-color` meta updates

## Testing

- Manual: first load dark; toggle all three modes; refresh persists
- `npm test` — no regressions
