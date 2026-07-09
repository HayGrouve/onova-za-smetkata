# Redesign R4 — Cleanup & QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all dead CSS from the old design language and run the final both-modes accessibility and QA pass.

**Architecture:** CSS-only deletions guarded by usage greps, then a manual audit checklist. No behavior changes.

**Tech Stack:** Tailwind CSS v4, ripgrep

**Spec:** `docs/superpowers/specs/2026-07-09-redesign-slate-copper-design.md` (§6, §7-R4)

**Depends on:** R1–R3 complete

**Status:** ✅ Complete

---

## Task 1: Delete dead CSS classes

**Files:**
- Modify: `src/styles.css`

- [x] **Step 1: Verify each class is unused before deleting**

Run for each name:

```bash
rg 'island-shell|island-kicker|feature-card|nav-link|rise-in|display-title|page-wrap|site-footer' src/ --glob '!styles.css'
```

Expected: no matches (if `site-footer` or `page-wrap` matches, keep that rule and note it).

- [x] **Step 2: Delete the rules**

Remove from `src/styles.css`:

- `.island-shell`, `.island-kicker`
- `.feature-card`, `.feature-card:hover`
- `.nav-link`, `.nav-link::after`, `.nav-link:hover…` block
- `.rise-in` + `@keyframes rise-in`
- `.page-wrap` (if unused per Step 1)
- `.site-footer` (if unused per Step 1)

- [x] **Step 3: Verify no leftover old-palette variables**

Run: `rg 'sea-ink|lagoon|palm|--sand|--foam|--surface|--line|inset-glint|kicker|bg-base|header-bg|chip-bg|chip-line|link-bg-hover|hero-a|hero-b' src/`
Expected: no matches. Delete any stragglers found.

---

## Task 2: File structure pass on `styles.css`

**Files:**
- Modify: `src/styles.css`

- [x] **Step 1: Reorder to the target structure**

1. Font import
2. Tailwind imports + plugins + `@custom-variant`
3. `:root` tokens (colors, radius, motion)
4. `.dark` tokens
5. `@theme inline`
6. Base styles (`html`, `body`, `a`, `code`, cursor rules)
7. `@layer utilities` (`.money`, `.page-container*`, `.page-shell`, `.sticky-surface`, `.tap-feedback`, `.interactive-hover`, guest animations, scan pulse)
8. Reduced-motion guard

No value changes — move-only.

- [x] **Step 2: Preflight**

Run: `pnpm run preflight`
Expected: PASS

---

## Task 3: Accessibility + visual audit

- [x] **Step 1: Contrast checks (both modes)**

Verify with a contrast checker (e.g., polypane.app/color-contrast or WebAIM):

| Pair | Requirement |
|------|-------------|
| `foreground` on `background` | ≥ 4.5:1 |
| `muted-foreground` on `background` | ≥ 4.5:1 |
| `primary-foreground` on `primary` | ≥ 4.5:1 |
| `accent-foreground` on `accent` | ≥ 4.5:1 |
| `success-foreground` on `success` | ≥ 4.5:1 |
| `destructive` on `background` (error text) | ≥ 4.5:1 |
| `border` vs `background` | ≥ 3:1 (UI) |

Fix any failing token by adjusting L in oklch (keep hue/chroma), re-run preflight.

- [x] **Step 2: Reduced-motion audit**

Enable OS reduce-motion. Expected: no transforms/lifts on buttons, no step slide animation, sheets/dialogs appear instantly, scan indicator static.

- [x] **Step 3: Full-flow manual QA (light + dark)**

1. Home: bill list, search, create
2. Editor steps 1→4: scan, participants, assignment, review
3. Finalize + payments recording
4. Guest: join → claim → pay CTAs
5. Sheets: payment settings, friend groups, receipt review, breakdown
6. Offline banner, PWA install banner, 404, login

- [x] **Step 4: Update plan status to ✅ Complete; mark redesign spec Status → Complete**

---

## Self-review (spec coverage)

| Spec requirement (§) | Task |
|------------------|------|
| §6 dead CSS removal | Task 1 |
| §6 styles.css target structure | Task 2 |
| §1.2 WCAG AA both modes | Task 3 |
| §3 reduced-motion audit | Task 3 |
| §7-R4 full QA | Task 3 |

**Redesign complete after this phase.**
