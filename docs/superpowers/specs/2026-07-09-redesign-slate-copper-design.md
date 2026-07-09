# Redesign — „Графит + мед" (Slate + Copper)

**Date:** 2026-07-09  
**Status:** ✅ Complete (R1–R4 implemented)  
**Scope:** Full visual redesign (color system, typography, motion) + bill editor restructure into guided steps. Guest flows and all other screens are reskin-only.

---

## Goal

Give the app a professional, clean, distinctive look that does not follow default trends: solid colors (no gradients, no glassmorphism), a graphite base with a warm copper accent, slow subtle animations on interactive elements only, and an easier host workflow via a 4-step guided bill editor.

Decisions made during brainstorm (user-selected):

| Decision | Choice |
|----------|--------|
| Color direction | **D — Slate + Copper** (graphite neutral base, copper accent) |
| Editor structure | **B — Guided steps** (4 focused screens with progress bar) |
| Typography | **A — Manrope (kept) + IBM Plex Mono for amounts** |
| Guest flows | **A — Reskin only** (no structural change) |
| Motion | Slow (~250ms), subtle, interactive areas only |

---

## Non-goals

- No changes to Convex schema, mutations, or validation (VAL-0–VAL-6 stays as-is)
- No restructuring of guest join/claim flows (reskin only)
- No new features (payment providers, multi-currency, item notes UI, etc.)
- No desktop-specific layouts (stays mobile-first `max-w-lg`)
- No logo/brand-name change

---

## 1. Color system

### 1.1 Single token set

The current dual system — custom sea/lagoon hex variables **plus** neutral shadcn oklch tokens — collapses into **one** shadcn semantic token set. All references to `--sea-ink`, `--lagoon`, `--palm`, `--sand`, `--foam`, `--surface`, `--hero-*`, `--chip-*`, etc. are removed from CSS and components.

Removed along with them:

- Body layered radial/linear gradients and the fixed grid-texture pseudo-elements (`body::before`, `body::after`)
- Translucent "glass" surfaces (`--surface: rgba(...)`, `--header-bg` blur) — sticky surfaces become solid card color with a bottom border
- The emerald finalize-button override — finalize uses the new `success` token

### 1.2 Token values

Reference values in hex; implementation converts to oklch. All pairs must pass WCAG AA (4.5:1 body text, 3:1 large text/UI).

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `#faf9f7` | `#121214` |
| `--card` / `--popover` | `#ffffff` | `#1c1c20` |
| `--border` | `#e5e2da` | `#333338` |
| `--input` (R4 amendment: darker than `--border` so form fields meet WCAG 1.4.11 ≥3:1) | `oklch(0.64 0.01 84)` | `oklch(0.53 0.008 286)` |
| `--foreground` | `#2b2b33` | `#e8e6e1` |
| `--muted` | `#f1efea` | `#232327` |
| `--muted-foreground` | `#6b6b74` | `#a3a19b` |
| `--primary` | `#a4551e` | `#e08540` |
| `--primary-foreground` | `#ffffff` | `#2a1505` |
| `--accent` | `#f6e8dc` | `#45260f` |
| `--accent-foreground` | `#a4551e` | `#eda05f` |
| `--destructive` | `#c03a2e` | `#e0604f` |
| `--success` (new) | `#2e7d4f` | `#5cba8a` |
| `--success-foreground` (new) | `#ffffff` | `#0b2417` |
| `--ring` | copper at 40% | copper at 40% |

Notes:

- `--success` is a **new** token (used by: finalize CTA, paid badges, payment progress bars, positive statuses). Register it in `@theme inline` as `--color-success` / `--color-success-foreground`.
- Warning/attention states (unassigned items, totals mismatch, offline banner) move from amber to **copper accent** (`--accent` bg + `--accent-foreground` text) — one warm hue across the app instead of amber + teal + emerald.
- `--radius` stays `0.625rem`.
- Chart and sidebar token blocks stay but are recolored to the new palette (charts: copper, graphite, muted green, warm gray scale).
- `theme-color` meta tags in `__root.tsx` update to `#faf9f7` / `#121214`.

### 1.3 Semantic usage rules

| Use | Token |
|-----|-------|
| Primary CTA (one per screen max) | `primary` |
| Secondary buttons | `card` bg + `border`, foreground text |
| Links | `primary` |
| Draft badge | `accent` bg + `accent-foreground` |
| Final badge / paid state / finalize CTA | `success` |
| Unassigned / needs attention | `accent` (copper), destructive only for true errors |
| Validation errors | `destructive` (unchanged behavior) |

---

## 2. Typography

- **Manrope** (kept): all UI text. Weights 400/500/600/700/800. Headings 700–800; body 400–500.
- **IBM Plex Mono 500** (new): every money amount, via a `.money` utility class:

```css
.money {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
```

- Applied to: bill card totals, sticky totals bar, item prices, assignment amounts, summary breakdowns, payment rows, claim footer, receipt review totals.
- **Fraunces is removed** from the Google Fonts import (unused `.display-title` class deleted).
- Font import trimmed to: Manrope 400;500;600;700;800 + IBM Plex Mono 500.

---

## 3. Motion system

### 3.1 Tokens

```css
:root {
  --motion-slow: 250ms;
  --motion-press: 120ms;
  --motion-ease: cubic-bezier(0.22, 1, 0.36, 1); /* ease-out-quint-ish */
}
```

### 3.2 Rules

- Animations apply **only to interactive elements** — no ambient/decorative animation.
- **Buttons:** background-color + shadow fade 250ms; hover lifts `translateY(-1px)` with a soft copper shadow; press scales `0.98` at 120ms.
- **List rows / tappable cards:** border-color + background fade 250ms on hover/focus.
- **Inputs:** focus ring fades in 250ms.
- **Step transitions (editor):** outgoing step fades out, incoming slides up 8px + fades in, 250ms total.
- **Sheets/dialogs:** keep tw-animate enter/exit, retimed to 250ms with `--motion-ease`.
- **Receipt scan indicator:** replace the current 2s infinite border pulse with a slower (3s) subtle copper border glow.
- Existing guest micro-animations (`guest-count-pop`, `guest-total-pulse`, `guest-status-in`) are kept and retimed to the motion tokens.
- **`prefers-reduced-motion: reduce`** disables all transforms and non-essential transitions globally:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 4. Bill editor → guided steps

### 4.1 Structure

The monolithic `/bills/$billId/` editor becomes **4 steps within the same route**. Step state lives in the URL search param (`?step=1..4` via TanStack Router `validateSearch`), so refresh, back button, and deep links work.

| Step | Name | Content (existing components, refocused) |
|------|------|------------------------------------------|
| 1 | **Бележка** | Receipt photo upload/camera, scan CTA + review sheet, restaurant / tip / date / note fields |
| 2 | **Участници** | Participant list, friend groups, recent names, invite card (QR + share) |
| 3 | **Разпределение** | Item list + per-item assignment UI, "raздели поравно" bulk action |
| 4 | **Преглед** | Current summary content inline as the final step: totals, breakdown, per-participant payments, finalize CTA |

Notes:

- The separate `/bills/$billId/summary` route **remains** (it is linked from finalized bill cards and share flows) but its content is extracted into a shared component rendered both by the route and by step 4.
- Existing child components (`ItemList`, `ParticipantList`, `BillInviteCard`, receipt scan hooks/sheets) are reused as-is; only their placement changes.
- Finalized bills: opening the editor redirects to step 4 (read-only review), consistent with current `readOnly` behavior.

### 4.2 Chrome

- **Progress bar** under the app header: 4 copper segments; completed and current steps filled. Each segment is tappable — navigation is **free**, not gated. Segment labels visible on the current step ("Стъпка 2 · Участници").
- **Sticky bottom bar** replaces the current sticky totals bar on steps 1–3:
  - Left: running total (`.money`) — tap opens the existing totals breakdown sheet
  - Right: **Назад / Напред** buttons (primary for Напред)
  - Step 3 shows an unassigned counter chip ("2 неразпределени") in copper accent
- Step 4 keeps the current summary action layout (finalize CTA with `success` token).

### 4.3 Guidance instead of gates

- No step blocks the next one. Empty states carry the guidance: e.g., step 3 with no participants shows "Добавете участници на стъпка 2" with a jump link.
- The current finalize validation (`validateBillForFinalize`) is unchanged and remains the only hard gate.

### 4.4 Payment settings visibility fix

Step 4 shows a dismissible hint card when the host has no payment settings configured: "Настройте начин на плащане (Revolut / IBAN), за да могат гостите да плащат лесно" → opens the existing payment settings sheet. (Currently this is buried in the header overflow menu.)

---

## 5. Screen-by-screen (reskin only)

| Screen | Changes |
|--------|---------|
| **Home** | Solid background; bill cards on `card` token with border; copper "Нова сметка" CTA; search input restyled; footer marketing block simplified (shorter, no gradient chips) |
| **Login** | New tokens/typography; no structural change |
| **Join** (guest) | New tokens; name chips use `accent` for taken states |
| **Claim** (guest) | New tokens; tabs use copper underline; sticky pay footer solid surface; `.money` on amounts |
| **Sheets/dialogs** | Solid `popover` surfaces (no blur/transparency); retimed animations |
| **Offline banner** | Amber → copper accent |
| **PWA install banner/footer** | New tokens; no structural change |
| **404** | New tokens |

Toast position stays top-center (already changed).

---

## 6. Cleanup (part of this redesign)

- Delete dead CSS: `.island-shell`, `.feature-card`, `.nav-link`, `.rise-in`, `.display-title`, sea/lagoon variable block, body gradient/texture pseudo-elements.
- Delete amber-specific classes where replaced by copper accent.
- `styles.css` target structure: font import → tailwind imports → token blocks (`:root`, `.dark`) → `@theme inline` → base styles → utilities (`.money`, `.page-container*`, `.sticky-surface`, motion helpers, guest animations).
- Audit components for hardcoded colors (`amber-*`, `emerald-*`, `text-destructive` misuse) and map to tokens. Known: finalize button emerald override, unassigned amber borders, offline banner amber, low-confidence scan rows amber, claim footer, payment progress bars.

---

## 7. Rollout — 4 phases, each independently shippable

| Phase | Scope | Risk |
|-------|-------|------|
| **R1 — Tokens + typography + motion** | New token values, `.money` utility, motion tokens, body/background cleanup, font import change, theme-color meta | Low — pure CSS/token swap |
| **R2 — Component polish** | Buttons, cards, badges, inputs, sheets, banners mapped to semantic tokens; amber/emerald hardcodes removed | Low-medium |
| **R3 — Editor stepper** | Step search param, progress bar, sticky nav bar, summary extraction into shared component, payment settings hint | Medium — structural |
| **R4 — Cleanup + QA** | Dead CSS removal, both-modes contrast audit, reduced-motion audit, manual QA of all flows | Low |

Each phase ends with `pnpm run preflight`. R3 requires manual QA of the full host flow (create → scan → participants → assign → finalize) and guest flow regression.

### Testing

- Existing unit tests unaffected (no logic changes until R3; R3 moves components without changing behavior).
- R3: verify step deep links (`?step=3`), back/forward navigation, finalized-bill redirect to step 4.
- Visual QA checklist per phase: light + dark, contrast spot checks on primary/accent/success pairs, reduced-motion.

---

## Open items deliberately deferred

- Desktop/tablet layout enhancements
- Home screen information architecture (filters, sorting)
- Guest flow restructure (full-bill visibility for guests)
- Chart token usage (no charts rendered today)
