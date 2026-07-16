# Claim Share Drawer — Design Spec

**Date:** 2026-07-16  
**Status:** Complete  
**Scope:** Turn the claim-page „Разбивка на дяла“ footer into a persistent bottom drawer with peek + expanded snaps (guest and host claim)  
**Approach:** 1 — Vaul / shadcn Drawer with snap points  
**Builds on:** `2026-07-07-guest-qr-claim-flow-design.md`, `2026-07-15-host-auto-participant-design.md`

---

## Problem

On guest and host claim pages, the fixed bottom „Разбивка на дяла“ panel always shows the full item breakdown. That steals vertical space from claiming items. Users need a small default summary (amount + pay actions) and should be able to swipe up for full line-item detail.

## Solution

Replace the always-expanded claim footer with a **persistent Vaul bottom drawer** that never fully closes:

- **Peek (default):** drag handle, title, status, amount + pay actions.
- **Expanded:** line-item breakdown + guest „Плати и за“ chips above a **sticky** amount/pay bar.

Shared shell used by both `GuestClaimFooter` and `HostClaimFooter`.

## UX decisions

| Topic                     | Choice                                                        |
| ------------------------- | ------------------------------------------------------------- |
| Who gets it               | Guest claim **and** host claim (`mode=host`)                  |
| Collapsed content         | Amount + pay actions (Revolut/IBAN guest; host coverage copy) |
| Combined-pay chips        | Expanded only                                                 |
| Pending transfer + cancel | Stay in **peek** (actionable, not buried)                     |
| Expanded layout           | Sticky summary at bottom of drawer (Approach A)               |
| Fully dismissible         | No — always at least peek                                     |
| Default snap              | Peek                                                          |
| Expanded dismiss          | Swipe down to peek, or tap light scrim over the claim list    |
| Tech                      | shadcn Drawer (Vaul) with two snap points                     |

---

## Interaction

1. Land on claim → drawer at **peek**. Claim item list has bottom spacer equal to peek height.
2. Swipe up on handle / drawer, or activate the expand control → **expanded** (~70dvh, capped similarly to today’s `min(75dvh, 36rem)`).
3. Expanded shows a light scrim over the item list; tap scrim → peek.
4. Inside expanded: scrollable breakdown + chips; amount + Revolut/IBAN (or host note) remain pinned at the bottom of the drawer.
5. Nested scroll: vertical pan on the summary strip / handle drives snap; pan on the line-item region scrolls content when expanded.

---

## Content map

### Peek (always visible)

| Element                                 | Guest                                          | Host                                          |
| --------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| Drag handle                             | Yes                                            | Yes                                           |
| Title „Разбивка на дяла“ + status badge | Yes                                            | Yes (badge reflects paid-by-rule / „платено“) |
| Amount label + money                    | Вашият дял / Остатък / combined total as today | Дял / Остатък (0) as today                    |
| Primary actions                         | Revolut / IBAN                                 | „Покрито като домакин“ (no Revolut/IBAN)      |
| Pending transfer hint + Cancel          | When `transferInitiated`                       | N/A                                           |

### Expanded (above sticky summary)

| Element                               | Guest             | Host |
| ------------------------------------- | ----------------- | ---- |
| Removable item lines + tip lines      | Yes               | Yes  |
| „Плати и за“ chips + combined copy    | Yes               | No   |
| Covered-guest / combined amount lines | Yes when relevant | N/A  |

Payment mutation behavior (solo/combined Revolut, IBAN copy, host paid-by-rule) is **unchanged** — only chrome and layout move.

---

## Architecture

### New

- `src/components/ui/drawer.tsx` — shadcn Drawer wrapping Vaul (`pnpm dlx shadcn@latest add drawer`).
- `src/components/bills/claim-share-drawer.tsx` — shared shell:
  - Props: `summary` (sticky peek content: amount + actions), `details` (expanded-only: lines + chips), optional title / status slot.
  - Uncontrolled snap by default (`peek`); optional `snap` / `onSnapChange` for tests.
  - Owns snap points, handle, scrim, and list spacer (= **peek** height only so expand overlays the list).
  - Accessible expand/collapse control (`aria-expanded`).

### Refactor (no behavior change beyond layout)

- `GuestClaimFooter` — compose `ClaimShareDrawer`; move chips into `expanded`; keep amount + pay + pending in sticky `peek`/summary region.
- `HostClaimFooter` — same shell; host summary copy in peek; breakdown lines in expanded.

### Unchanged

- `ParticipantBreakdownContent` line-item rendering and remove-item confirm flow.
- Convex payment / assignment APIs.

```
Claim page
  └─ item list (+ bottom spacer = peek height)
  └─ ClaimShareDrawer (Vaul)
       ├─ expanded body (scroll): lines [, chips]
       └─ sticky footer: amount + actions [, pending]
```

---

## Edge cases

| Case                                  | Behavior                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------- |
| Zero claimed items                    | Peek still shows €0 / empty-state friendly totals; expanded shows existing empty copy     |
| Long item list in expanded            | Scroll inside expanded region; sticky summary stays put                                   |
| Combined pay selected while collapsed | Amount in peek updates; chips only visible after expand (user can expand to change chips) |
| Read-only / finalized bill            | Same drawer; remove controls disabled as today                                            |
| Desktop / no touch                    | Click handle or title toggles snap; keyboard button toggles                               |
| Safe area                             | Bottom padding keeps `env(safe-area-inset-bottom)`                                        |

---

## Out of scope

- Changing Revolut / IBAN / combined-payment business rules
- Host step-4 summary payment rows
- Persisting last snap across navigations
- Mid snap (three-position drawer)

---

## Testing

### Manual / browser

- Guest: peek shows amount + Revolut; expand shows lines + chips; sticky pay bar never scrolls away; scrim collapses to peek.
- Host: same snaps; no Revolut; „Покрито като домакин“ in peek.
- Combined: select chips only when expanded; peek amount reflects selection after collapse.

### Automated

- Prefer a focused unit/component test on snap labeling / content slots if a clean seam exists after extraction.
- Extend existing claim e2e smoke only if stable selectors for handle/expand are cheap; otherwise manual QA for v1 gestures.

---

## Success criteria

1. Default claim view shows a short peek; most of the viewport is the item list.
2. Users can reveal full breakdown via swipe/tap without leaving the page.
3. Guest can pay from peek without opening the breakdown.
4. Guest and host share one drawer implementation.
