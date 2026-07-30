# AppHeaderMenu — context-aware menu spec

Build-ready spec for map [#82](https://github.com/HayGrouve/onova-za-smetkata/issues/82). Implements decisions from [#83](https://github.com/HayGrouve/onova-za-smetkata/issues/83), [#84](https://github.com/HayGrouve/onova-za-smetkata/issues/84), [#87](https://github.com/HayGrouve/onova-za-smetkata/issues/87), [#88](https://github.com/HayGrouve/onova-za-smetkata/issues/88). Action inventory: `research/header-menu-bill-actions-audit.md`.

## Composition rules (all contexts)

| Section                       | When shown                                          |
| ----------------------------- | --------------------------------------------------- |
| Viewer label                  | Authenticated host (`showHostActions`)              |
| **Сметка** bill group         | Host on a bill-scoped route with `billId` in params |
| Theme (light / dark / system) | Always (menu visible on all routes)                 |
| Global host items             | Authenticated host, not login, not guest route      |

Global host items (unchanged order): Профил → Настройки за плащане → Моите групи → Помощ и напътствия → Изход.

Guest routes (`/join`, guest `/claim`): theme only ([#84](https://github.com/HayGrouve/onova-za-smetkata/issues/84)).

Bill routes: merge — bill group above theme, then global host items ([#83](https://github.com/HayGrouve/onova-za-smetkata/issues/83)).

---

## Menu matrix

Legend: **show** = enabled item · _disabled_ = visible, disabled · — = hidden · `(destructive)` = destructive variant · confirm = existing copy from `destructive-action-copy.ts` or finalize dialog.

### Home `/`

| Section | Items                 |
| ------- | --------------------- |
| Bill    | —                     |
| Theme   | light / dark / system |
| Host    | full global list      |

### Login `/login`

| Section | Items                       |
| ------- | --------------------------- |
| Bill    | —                           |
| Theme   | light / dark / system       |
| Host    | — (`showHostActions=false`) |

### Bill editor `/bills/$billId` (draft)

| Order | Item                       | Eligibility    | Behavior                                                                         |
| ----- | -------------------------- | -------------- | -------------------------------------------------------------------------------- |
| 1     | **Сподели линк**           | ≥1 participant | Client share join URL (`BillInviteCard` logic)                                   |
| 2     | **Обнови линка**           | draft          | `bills.rotateShareToken` + inline confirm dialog (reuse `BillInviteCard` copy)   |
| 3     | **Завърши сметка**         | draft          | Opens finalize confirm dialog; see [Finalize disabled UX](#finalize-disabled-ux) |
| 4     | **Изтрий** `(destructive)` | always         | `bills.remove` + `getBillDeleteCopy`                                             |

Then theme → global host items.

Notes:

- Available on **all editor steps** (1–4), not step-3-only.
- Final bills redirect away from editor; no matrix row needed.

### Bill summary `/bills/$billId/summary`

**Draft**

| Order | Item                       | Eligibility | Behavior                                                          |
| ----- | -------------------------- | ----------- | ----------------------------------------------------------------- |
| 1     | **Завърши сметка**         | draft       | Same as editor; see [Finalize disabled UX](#finalize-disabled-ux) |
| 2     | **Редактирай**             | draft       | Navigate to `/bills/$billId?step=1`                               |
| 3     | **Сподели сметка**         | always      | Client text share (`ShareBillButton` / `formatBillShareText`)     |
| 4     | **Изтрий** `(destructive)` | always      | `bills.remove` + confirm → home                                   |

**Final**

| Order | Item                       | Eligibility | Behavior                        |
| ----- | -------------------------- | ----------- | ------------------------------- |
| 1     | **Сподели сметка**         | always      | Client text share               |
| 2     | **Изтрий** `(destructive)` | always      | `bills.remove` + confirm → home |

Then theme → global host items.

### Host claim `/bills/$billId/claim?mode=host` (draft bill)

| Order | Item                       | Eligibility    | Behavior                            |
| ----- | -------------------------- | -------------- | ----------------------------------- |
| 1     | **Сподели линк**           | ≥1 participant | Client share join URL               |
| 2     | **Обнови линка**           | draft          | rotate + confirm                    |
| 3     | **Към редактора**          | draft          | Navigate to `/bills/$billId?step=1` |
| 4     | **Изтрий** `(destructive)` | always         | `bills.remove` + confirm → home     |

No **Завърши сметка** on host claim (finalize belongs on summary / editor).

Then theme → global host items.

### Guest join `/bills/$billId/join`

Theme only.

### Guest claim `/bills/$billId/claim` (no `mode=host`)

Theme only.

---

## Finalize disabled UX

Mirror `BillSummaryContent` today:

| Condition                                                                        | Menu item state | Feedback                                                                     |
| -------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------- |
| `status === 'final'`                                                             | hidden          | —                                                                            |
| `validateBillForFinalize` passes, all paid                                       | enabled         | Opens finalize dialog                                                        |
| `unpaidCount > 0` (and not otherwise ready)                                      | _disabled_      | Tooltip: „Всички гости трябва да платят, преди да завършите сметката.“       |
| Other validation failure (`missing_restaurant`, `no_items`, `empty_units`, etc.) | _disabled_      | No tooltip on menu item; host uses inline summary error card when on summary |

Finalize dialog: reuse existing copy; dialog confirm button disabled while `unpaidCount > 0`.

Server: UI restricts to draft; reuse `validateBillForFinalize` from `shared/bill-calculations.ts`.

---

## Duplicate affordances ([#87](https://github.com/HayGrouve/onova-za-smetkata/issues/87))

**Partial** — header canonical on bill routes; keep page-level controls where they serve as primary CTAs or step-specific layout.

| Surface                                       | After implementation                                               |
| --------------------------------------------- | ------------------------------------------------------------------ |
| **Home `BillCard` ⋮ → Изтрий**                | **Keep** — home has no bill-scoped header group                    |
| **Summary inline „Завърши сметка“**           | **Keep** — primary full-width CTA                                  |
| **Summary inline „Редактирай“ / „Изтрий“**    | **Remove** — header only                                           |
| **`ShareBillButton` on summary**              | **Remove** — header **Сподели сметка** only                        |
| **`BillInviteCard` share / rotate on step 3** | **Keep** — QR + step UX; header duplicates actions for other steps |

---

## Architecture ([#88](https://github.com/HayGrouve/onova-za-smetkata/issues/88))

### Config module (pure, testable)

`shared/app-header-menu-config.ts`:

- Input: `{ routeContext, billStatus, billId?, participantCount, finalizeValidation, unpaidCount, embedded? }`
- Output: ordered list of menu item descriptors (`id`, `label`, `variant`, `disabled`, `hidden`, `tooltip?`)

`routeContext` enum: `home` | `login` | `editor` | `summary` | `hostClaim` | `guestJoin` | `guestClaim`.

Route → context mapping lives in `AppHeader` (extend `useHeaderConfig`).

### Data loading

`AppHeader` already reads `billId` from params. Add `useQuery(api.bills.get, …)` for all bill-scoped host routes (editor, summary, host claim), not summary-only.

For finalize eligibility, reuse the same validation inputs as `BillSummaryContent` (or a shared helper in `shared/`).

### Action handlers

New hook `useBillHeaderMenuActions(billId)` in `src/hooks/`:

- Wraps `bills.finalize`, `bills.remove`, `bills.rotateShareToken`
- Reuses `useConfirmAction`, `getBillDeleteCopy`, finalize dialog state
- Share actions delegate to existing `share-link` / `formatBillShareText` utilities

`AppHeaderMenu` receives `billMenuItems` + `onBillAction` from hook, or renders from config + handler map — no prop drilling into bill tree.

### No new React context provider

Route params + Convex query from layout header is sufficient; bill pages do not register context.

---

## Out of scope

- Reopen / unfinalize bill
- New mutations beyond today's inventory
- Guest bill-management items
- Implementation (follow-up session)
