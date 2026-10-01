# Visual languages (Taste-locked)

Every font below was checked on Google Fonts for `cyrillic` and `cyrillic-ext` subsets on 2026-10-01. Load fonts with `useGoogleFont()` from `mock/fonts.ts`. Apply `font-variant-numeric: tabular-nums` to every amount.

These rules apply to all three directions:
- One accent per direction, and it locks across every screen.
- One radius rule per direction.
- Shadows are tinted, never pure black.
- No `#000` and no `#fff`.
- Zero em dashes and zero en dashes.
- No decorative dots. Status dots are allowed only for real state (paid, pending, joined).
- No eyebrow labels above every section.
- Lucide icons only, at stroke 1.75.

## A. Familiar / Efficient

**Type.** Geist (UI) and Geist Mono (only for IBAN and reference codes; money uses Geist with tabular-nums).
- Font URL: `https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500&display=swap`
- Type scale: 13/15/17/22/32. Weights 400, 500 and 600. Tracking: `-0.01em` on headings and `-0.02em` on big amounts.

**Palette.** Cool zinc neutrals with a cobalt accent, which carries trust. It reads as a familiar fintech blue without copying any one brand. Values are in oklch.

| Token | Light | Dark |
|---|---|---|
| bg | 0.985 0.002 250 | 0.17 0.005 260 |
| surface | 0.995 0 0 | 0.215 0.006 260 |
| surface-2 | 0.965 0.003 250 | 0.25 0.007 260 |
| text | 0.24 0.01 260 | 0.94 0.004 250 |
| muted | 0.52 0.012 260 | 0.70 0.01 255 |
| hairline | 0.92 0.004 250 | 0.30 0.008 260 |
| accent (cobalt) | 0.52 0.19 262 | 0.68 0.15 258 |
| accent-soft | 0.95 0.03 262 | 0.30 0.07 262 |
| paid (green) | 0.55 0.13 155 | 0.72 0.13 155 |
| pending (amber) | 0.68 0.15 70 | 0.78 0.13 75 |
| danger | 0.56 0.19 27 | 0.66 0.17 27 |

**Shape.** Groups are 14px, buttons and inputs are 10px, and chips and avatars are pill-shaped. Lists are grouped inside one inset surface with hairline dividers (the iOS grouped-list pattern); there are no nested cards. The only shadow is on sheets: `0 -8px 30px oklch(0.24 0.01 260 / 0.12)`.

**Signature details.**
- A top balance header in the style of a banking app.
- Segmented tabs.
- Avatar stacks on rows.
- Status pills: Чака, Платено, Дължи.
- A sticky bottom summary bar with a thin progress meter: no track, just a fill on a hairline.

**Motion (3).** Sheets slide in, and the tab underline moves. Nothing else.

## B. Focus

**Type.** Sofia Sans, designed by Botio Nikoltchev, a Bulgarian type designer. It has native Bulgarian letterforms, so the product reads as local.
- Font URL: `https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@300;400;500;600;700;800&display=swap`
- Display amounts: 300 weight at 64 to 96px, tracking `-0.04em`.
- Questions: 600 weight at 28 to 34px, line-height 1.1.
- Body: 17px, 400 weight.

**Palette.** Monochrome off-white and off-black with a single emerald accent. Emerald means money moving, so it is both the primary action and the paid state. Pending uses ink with a thin outline ring instead of a second hue; the one exception is a warning that is a real problem, which uses amber in text only.

| Token | Light | Dark |
|---|---|---|
| bg | 0.975 0.003 160 | 0.16 0.006 165 |
| surface | 0.99 0.002 160 | 0.2 0.008 165 |
| text | 0.2 0.01 165 | 0.95 0.004 160 |
| muted | 0.55 0.01 165 | 0.68 0.01 160 |
| line | 0.9 0.005 160 | 0.3 0.01 165 |
| accent (emerald) | 0.52 0.13 162 | 0.74 0.14 162 |
| accent-ink (text on accent) | 0.98 0.01 162 | 0.18 0.04 162 |
| warn | 0.62 0.14 65 | 0.8 0.12 75 |

**Shape.** Interactive elements are pill-shaped. Large surfaces and sheets use a 28px radius. There are almost no borders: separation comes from space and from size contrast. There are no shadows except a soft lift on sheets.

**Signature details.**
- One huge number per screen.
- Questions are written as sentences ("Кой беше на масата?").
- A thin 2px progress line at the very top.
- Large round "+" claim buttons.
- A quiet „Детайли“ drawer.
- Generous 24 to 32px gutters.

**Motion (5).** Numbers roll on change, because the amount is the subject. Screens cross-fade and slide 12px to show sequence. The primary button gets a press scale.

## C. Живата сметка (live receipt)

**Type.**
- Unbounded (display: totals, stamps, phase names). Weights 500 to 800.
- Martian Mono (receipt lines, labels, UI text). Weights 400 to 600. Use the `wdth` axis around 87 for narrow screens if needed.
- Font URL: `https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Martian+Mono:wdth,wght@75..112.5,400..600&display=swap`

**Palette.** Thermal-paper receipt on an ink-slate "table". Vermilion stamp ink is the single accent; it evolves the current copper brand into rubber-stamp red-orange. The paper is a cool thermal white, not cream.

| Token | Light | Dark |
|---|---|---|
| table | 0.9 0.008 250 | 0.2 0.02 255 |
| table-2 | 0.86 0.01 250 | 0.24 0.022 255 |
| paper | 0.985 0.003 95 | 0.94 0.006 95 (paper stays light in dark mode; it is an object) |
| ink | 0.22 0.015 255 | same on paper |
| ink-muted | 0.5 0.015 255 | same |
| on-table text | 0.25 0.02 255 | 0.92 0.01 250 |
| accent (vermilion) | 0.6 0.2 33 | 0.68 0.19 35 |

Seat identity colors are the one sanctioned exception to the single-accent rule, because they carry real meaning (who has what). Use five muted hues at the same lightness and chroma (around 0.7 0.09), always paired with the initial.

**Shape.** The receipt has a sharp 0 radius and perforated or zig-zag top and bottom edges, made with a CSS `mask` using a radial-gradient. Seats are circles. Buttons on the table are 999px pills. Stamps are rectangles with a double border, rotated -8 degrees. The receipt shadow is `0 30px 60px -20px oklch(0.2 0.02 255 / 0.45)`.

**Signature details.**
- Dotted leaders between item name and price.
- A perforated tear line before each person's slip.
- Stamps on the receipt: „ПЛАТЕНО“ (vermilion) and „ЧАКА“ (dashed ink).
- A seats rail with live presence rings.
- A live activity ticker in mono.
- The phase timeline Сглобяване, На масата, Разплащане.

**Motion (7).**
- A claim avatar springs onto the line, so you see who took what.
- The stamp scales from 1.4 to 1 with a slight rotation, giving feedback that the payment is settled.
- Tearing a slip translates and rotates it off the receipt, moving the guest from claiming to paying.
- New activity slides in, showing that the table is live.
- Every motion falls back to instant under reduced motion.
