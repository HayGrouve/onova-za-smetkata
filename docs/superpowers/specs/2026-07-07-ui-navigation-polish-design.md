# UI Navigation & Interaction Polish — Design Spec

**Date:** 2026-07-07  
**Project:** onova-za-smetkata  
**Status:** Approved  
**Builds on:** `docs/superpowers/specs/2026-07-07-personal-bill-splitter-design.md`

## Summary

Add a sticky top navigation bar with sensible back navigation across all screens, remove duplicate page titles, and apply consistent interaction polish (pointer cursor, subtle hover/active feedback) across tappable UI.

## Decisions

| Decision          | Choice                                                |
| ----------------- | ----------------------------------------------------- |
| Nav placement     | Sticky top bar                                        |
| Bill screen title | Back + restaurant name only (no screen label or tabs) |
| Animation level   | Subtle (~150ms, light scale/opacity on press)         |
| Editor bottom bar | Keep sticky totals + „Преглед“ unchanged              |
| Summary actions   | Keep „Редактирай“ at bottom; header back → editor     |

## Architecture

```
┌─────────────────────────────────────┐
│  AppHeader (sticky, route-aware)    │
├─────────────────────────────────────┤
│  Page content (Outlet)              │
│  - Home / Editor / Summary          │
└─────────────────────────────────────┘
```

**Layout wiring:** Root route renders `AppShell` wrapping `Outlet`. All pages share the same max-width container and top safe-area padding.

**No Convex or schema changes.** Bill title in header uses existing `api.bills.get` when on bill routes.

## Navigation behavior

| Route                    | Back button | Back destination          | Title                              |
| ------------------------ | ----------- | ------------------------- | ---------------------------------- |
| `/`                      | Hidden      | —                         | „Онова за сметката“                |
| `/bills/$billId`         | Visible     | `/` (Home)                | `bill.restaurantName` or „Без име“ |
| `/bills/$billId/summary` | Visible     | `/bills/$billId` (Editor) | Same restaurant name               |

**Title display:** Single line, truncated with ellipsis (`truncate`) when long. While bill data loads on bill routes, show „Зареждане…“ or skeleton in title area.

**Duplicate headings removed:**

- Home: remove standalone `<h1>` (header shows app title)
- Editor: remove „Редактиране на сметка“ `<h1>`
- Summary: remove top restaurant name block (header shows name + date can stay as subtitle below header OR move date into page content only — keep date under header in page body as muted text)

## Components

### `AppShell` (`src/components/layout/app-shell.tsx`)

- Renders `AppHeader` + `<main>` with consistent horizontal padding and bottom safe-area
- Accepts `children` (Outlet content)
- Applies shared page wrapper classes currently duplicated per route (`mx-auto max-w-lg px-4`, etc.)

### `AppHeader` (`src/components/layout/app-header.tsx`)

- Sticky: `sticky top-0 z-50`, backdrop blur, bottom border
- Left: back button (ChevronLeft) when not on home — uses TanStack Router `Link` or `navigate`
- Center/left-grow: title text
- Height: ~48–56px (`h-14`), respects `safe-area-inset-top`
- Back button: icon-only ghost button with `aria-label="Назад"`

**Bill routes:** `useParams` + `useQuery(api.bills.get, { billId })` for restaurant name.

## Interaction polish

### Global CSS (`src/styles.css`)

Add utility classes and base-layer rules:

```css
.tap-feedback {
  transition:
    transform 150ms ease,
    opacity 150ms ease;
}
.tap-feedback:active:not(:disabled) {
  transform: scale(0.98);
  opacity: 0.92;
}
.interactive-hover {
  transition:
    background-color 150ms ease,
    border-color 150ms ease;
}
```

Base cursor rules for `button`, `a`, `[role="button"]`, `[data-interactive]:not([data-disabled])` → `cursor: pointer`. Disabled → `cursor: not-allowed`.

### Component audit (add `cursor-pointer`, `tap-feedback`, `interactive-hover` where missing)

| Component / area                          | Change                                              |
| ----------------------------------------- | --------------------------------------------------- |
| `Button` (ui/button.tsx)                  | Add `cursor-pointer` to base cva                    |
| `BillCard`                                | `tap-feedback`, `interactive-hover`, ensure pointer |
| `StickyTotalsBar`                         | Tap areas (expand, Преглед link)                    |
| `PaymentRow`                              | Tappable header button                              |
| `ReceiptPreviewCard`                      | Thumbnail button                                    |
| Assignment chips / item rows              | Tappable toggles                                    |
| Raw `<button>` in editor (receipt upload) | `cursor-pointer tap-feedback`                       |

**Principle:** Any element that responds to click/tap gets pointer cursor and subtle active feedback. Form inputs keep `cursor-text` / default.

### Motion constraints

- No route transition animations
- No staggered list entrance
- No spring/bounce easing
- Shadcn Sheet/Dialog keep their built-in motion

## Root route changes

`src/routes/__root.tsx`:

- Add route `component` that renders `AppShell` with `Outlet`
- Keep `shellComponent` as document shell (html/body/providers)

## Out of scope

- Bottom tab navigation
- Breadcrumbs or editor/summary segmented control in header
- New pages (settings, about)
- Theme redesign
- Automated visual regression tests

## Verification

Manual checklist:

1. Home — no back button; app title in header; „Нова сметка“ still works
2. Editor — back goes home; title shows restaurant name; sticky bar unchanged
3. Summary — back goes to editor; title matches; „Редактирай“ still works
4. Hover (desktop) — cards/buttons show pointer; subtle press feedback on tap
5. Disabled buttons — not-allowed cursor, no scale on press
