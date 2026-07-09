# Redesign R1 — Tokens, Typography, Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the visual foundation to the Slate + Copper token set — solid backgrounds, new fonts, motion tokens — without touching any component structure.

**Architecture:** All changes live in `src/styles.css` plus the `theme-color` meta in `__root.tsx`. Components keep using semantic Tailwind classes (`bg-primary`, `border-border`, …) and pick up the new look automatically.

**Tech Stack:** Tailwind CSS v4 (`@theme inline`), oklch colors, Google Fonts

**Spec:** `docs/superpowers/specs/2026-07-09-redesign-slate-copper-design.md` (§1, §2, §3, §7-R1)

**Status:** ✅ Complete

---

## Task 1: Font import swap

**Files:**
- Modify: `src/styles.css:1`

- [x] **Step 1: Replace the Google Fonts import**

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500&display=swap');
```

Removes Fraunces (unused display font), adds IBM Plex Mono 500.

- [x] **Step 2: Delete the `.display-title` rule** (`src/styles.css` ~line 317)

```css
/* DELETE: */
.display-title {
  font-family: 'Fraunces', Georgia, serif;
}
```

---

## Task 2: New color tokens (light + dark)

**Files:**
- Modify: `src/styles.css` — `:root`, `.dark`, `@theme inline` blocks

- [x] **Step 1: Replace the `:root` block**

Delete the entire sea/lagoon variable set (`--sea-ink` … `--hero-b`) and the old shadcn values. New block:

```css
:root {
  /* Slate + Copper — light */
  --background: oklch(0.985 0.003 84);        /* #faf9f7 */
  --foreground: oklch(0.3 0.012 286);          /* #2b2b33 */
  --card: oklch(1 0 0);                        /* #ffffff */
  --card-foreground: oklch(0.3 0.012 286);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.3 0.012 286);
  --primary: oklch(0.52 0.13 55);              /* copper #a4551e */
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.955 0.006 84);          /* #f1efea */
  --secondary-foreground: oklch(0.3 0.012 286);
  --muted: oklch(0.955 0.006 84);
  --muted-foreground: oklch(0.54 0.012 286);   /* #6b6b74 */
  --accent: oklch(0.94 0.025 65);              /* copper tint #f6e8dc */
  --accent-foreground: oklch(0.52 0.13 55);
  --destructive: oklch(0.55 0.18 30);          /* #c03a2e */
  --destructive-foreground: oklch(1 0 0);
  --success: oklch(0.53 0.1 155);              /* #2e7d4f */
  --success-foreground: oklch(1 0 0);
  --border: oklch(0.905 0.009 84);             /* #e5e2da */
  --input: oklch(0.905 0.009 84);
  --ring: oklch(0.52 0.13 55 / 40%);
  --chart-1: oklch(0.52 0.13 55);
  --chart-2: oklch(0.3 0.012 286);
  --chart-3: oklch(0.53 0.1 155);
  --chart-4: oklch(0.7 0.02 84);
  --chart-5: oklch(0.76 0.11 60);
  --radius: 0.625rem;
  --sidebar: oklch(1 0 0);
  --sidebar-foreground: oklch(0.3 0.012 286);
  --sidebar-primary: oklch(0.52 0.13 55);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.94 0.025 65);
  --sidebar-accent-foreground: oklch(0.52 0.13 55);
  --sidebar-border: oklch(0.905 0.009 84);
  --sidebar-ring: oklch(0.52 0.13 55 / 40%);
}
```

- [x] **Step 2: Replace the `.dark` block**

```css
.dark {
  color-scheme: dark;
  /* Slate + Copper — dark */
  --background: oklch(0.18 0.004 286);         /* #121214 */
  --foreground: oklch(0.92 0.006 84);          /* #e8e6e1 */
  --card: oklch(0.225 0.005 286);              /* #1c1c20 */
  --card-foreground: oklch(0.92 0.006 84);
  --popover: oklch(0.225 0.005 286);
  --popover-foreground: oklch(0.92 0.006 84);
  --primary: oklch(0.7 0.14 55);               /* copper #e08540 */
  --primary-foreground: oklch(0.2 0.04 55);    /* #2a1505 */
  --secondary: oklch(0.25 0.005 286);          /* #232327 */
  --secondary-foreground: oklch(0.92 0.006 84);
  --muted: oklch(0.25 0.005 286);
  --muted-foreground: oklch(0.7 0.008 84);     /* #a3a19b */
  --accent: oklch(0.3 0.06 55);                /* #45260f */
  --accent-foreground: oklch(0.76 0.11 60);    /* #eda05f */
  --destructive: oklch(0.62 0.16 28);          /* #e0604f */
  --destructive-foreground: oklch(0.98 0.005 84);
  --success: oklch(0.71 0.1 155);              /* #5cba8a */
  --success-foreground: oklch(0.22 0.04 155);  /* #0b2417 */
  --border: oklch(0.3 0.006 286);              /* #333338 */
  --input: oklch(0.3 0.006 286);
  --ring: oklch(0.7 0.14 55 / 40%);
  --chart-1: oklch(0.7 0.14 55);
  --chart-2: oklch(0.92 0.006 84);
  --chart-3: oklch(0.71 0.1 155);
  --chart-4: oklch(0.45 0.01 286);
  --chart-5: oklch(0.76 0.11 60);
  --sidebar: oklch(0.225 0.005 286);
  --sidebar-foreground: oklch(0.92 0.006 84);
  --sidebar-primary: oklch(0.7 0.14 55);
  --sidebar-primary-foreground: oklch(0.2 0.04 55);
  --sidebar-accent: oklch(0.3 0.06 55);
  --sidebar-accent-foreground: oklch(0.76 0.11 60);
  --sidebar-border: oklch(0.3 0.006 286);
  --sidebar-ring: oklch(0.7 0.14 55 / 40%);
}
```

- [x] **Step 3: Register the success token in `@theme inline`**

Add after `--color-destructive-foreground`:

```css
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
```

This enables `bg-success`, `text-success-foreground`, etc.

---

## Task 3: Solid body + remove decorative layers

**Files:**
- Modify: `src/styles.css` — `body`, `body::before`, `body::after`, `.dark body*`, `a`, `code`, `.prose pre`, `.site-footer` rules

- [x] **Step 1: Replace the `body` rule**

```css
body {
  margin: 0;
  color: var(--foreground);
  font-family: var(--font-sans);
  background-color: var(--background);
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [x] **Step 2: Delete decorative rules entirely**

- `body::before` and `body::after` (grid texture + radial glows)
- `.dark body`, `.dark body::before`, `.dark body::after`

- [x] **Step 3: Retoken link and code styles**

```css
a {
  color: var(--primary);
  text-decoration-color: color-mix(in oklab, var(--primary) 40%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

a:hover {
  color: color-mix(in oklab, var(--primary) 85%, var(--foreground));
}

code {
  font-size: 0.9em;
  border: 1px solid var(--border);
  background: var(--muted);
  border-radius: 7px;
  padding: 2px 7px;
}
```

`.prose pre` — replace hardcoded navy with tokens:

```css
.prose pre {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--card);
  color: var(--card-foreground);
}
```

`.site-footer`:

```css
.site-footer {
  border-top: 1px solid var(--border);
  background: var(--card);
}
```

- [x] **Step 4: Make sticky surfaces solid**

Replace the `.sticky-surface` utility (and its md media query) with:

```css
.sticky-surface {
  @apply bg-card;
}
```

---

## Task 4: Motion tokens + `.money` utility

**Files:**
- Modify: `src/styles.css`

- [x] **Step 1: Add motion tokens to `:root`** (after `--radius`)

```css
  --motion-slow: 250ms;
  --motion-press: 120ms;
  --motion-ease: cubic-bezier(0.22, 1, 0.36, 1);
```

- [x] **Step 2: Retime global interactive transition**

Replace the `button, .island-shell, a { transition: ... 180ms ... }` block with:

```css
button,
a {
  transition:
    background-color var(--motion-slow) var(--motion-ease),
    color var(--motion-slow) var(--motion-ease),
    border-color var(--motion-slow) var(--motion-ease),
    box-shadow var(--motion-slow) var(--motion-ease),
    transform var(--motion-slow) var(--motion-ease);
}
```

- [x] **Step 3: Retime `.tap-feedback`**

```css
.tap-feedback {
  transition:
    transform var(--motion-slow) var(--motion-ease),
    opacity var(--motion-slow) var(--motion-ease),
    background-color var(--motion-slow) var(--motion-ease),
    border-color var(--motion-slow) var(--motion-ease);
}

.tap-feedback:active:not(:disabled):not([aria-disabled='true']) {
  transform: scale(0.98);
  opacity: 0.92;
  transition-duration: var(--motion-press);
}
```

- [x] **Step 4: Slow the receipt scan pulse to 3s**

```css
.receipt-scan-image-active {
  animation: receipt-scan-border-pulse 3s ease-in-out infinite;
}
```

- [x] **Step 5: Add `.money` utility** (inside `@layer utilities`)

```css
.money {
  font-family: 'IBM Plex Mono', ui-monospace, 'SF Mono', monospace;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
```

- [x] **Step 6: Add global reduced-motion guard** (end of file)

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Note: existing guest animations are already inside `@media (prefers-reduced-motion: no-preference)` — this guard covers everything else (tw-animate, tap-feedback).

---

## Task 5: theme-color meta

**Files:**
- Modify: `src/routes/__root.tsx:61-70`

- [x] **Step 1: Update meta values**

```tsx
{
  name: 'theme-color',
  content: '#faf9f7',
  media: '(prefers-color-scheme: light)',
},
{
  name: 'theme-color',
  content: '#121214',
  media: '(prefers-color-scheme: dark)',
},
```

---

## Task 6: Verification

- [x] **Step 1: Run preflight**

Run: `pnpm run preflight`
Expected: PASS (no component code changed; CSS-only)

- [x] **Step 2: Manual QA**

1. Home, light + dark: solid backgrounds, no gradients/texture
2. Buttons/links: copper color, ~250ms hover transitions
3. Bill editor + claim page render correctly (tokens only — layout unchanged)
4. OS reduced-motion on → no transitions
5. PWA title bar color matches new background

- [x] **Step 3: Update plan status to ✅ Complete**

---

## Self-review (spec coverage)

| Spec requirement (§) | Task |
|------------------|------|
| §1.2 token values light/dark | Task 2 |
| §1.2 success token + registration | Task 2 |
| §1.1 remove gradients/glass/texture | Task 3 |
| §2 font import (Manrope + Plex Mono, no Fraunces) | Task 1 |
| §2 `.money` utility | Task 4 |
| §3 motion tokens + retimed transitions | Task 4 |
| §3 reduced-motion guard | Task 4 |
| §3 scan pulse 3s | Task 4 |
| §1.2 theme-color meta | Task 5 |

**Next after completion:** R2 — `2026-07-09-redesign-r2-component-polish.md`
