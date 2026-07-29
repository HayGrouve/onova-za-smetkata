# Audit: existing bill actions in the UI

Research for [#85](https://github.com/HayGrouve/onova-za-smetkata/issues/85) — inventory of bill-level Convex mutations, where they surface in the UI, and eligibility rules (draft vs final, host auth, validation gates). Feeds the context-aware header menu map ([#82](https://github.com/HayGrouve/onova-za-smetkata/issues/82)).

## Summary

Bill management mutations live in `convex/bills.ts`. **No bill-level actions appear in `AppHeaderMenu` today** — that menu is global host settings only. Bill actions are scattered across the home list (`BillCard`), the bill editor (steps 1–4), and `BillSummaryContent` (standalone `/summary` or embedded step 4). Share join-link UX is on editor step 3 (`BillInviteCard`); a separate text-export share button is on the summary view (`ShareBillButton`).

---

## Convex: `bills.ts` mutations

| Mutation           | Auth               | Draft / final gate                                | What it does                                                                                                             |
| ------------------ | ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `create`           | `requireAuth`      | Always creates **draft**                          | New bill + host participant seat + `shareToken` (`convex/bills.ts`)                                                      |
| `update`           | `requireBillOwner` | **`assertBillDraft`**                             | Patch metadata: `restaurantName`, `date`, `note`, `receiptStorageId`, `tipCents`; Zod via `parseBillMetadataPatch`       |
| `finalize`         | `requireBillOwner` | No draft assert (idempotent re-finalize possible) | `assertBillCanFinalize` → `status: 'final'`, deletes guest sessions                                                      |
| `rotateShareToken` | `requireBillOwner` | **`assertBillDraft`**                             | New `shareToken`; returns `{ shareToken }`                                                                               |
| `remove`           | `requireBillOwner` | **None** (draft and final)                        | Cascade delete participants, items, assignments, payments, receipt storage, guest sessions; clears guided-bill reference |

Related queries (read-only, host): `list`, `listWithSummary`, `get` — all owner-scoped via `requireAuth` / `requireBillOwner`. Guest read: `getForGuest` (share token + optional session token).

Other bill-adjacent mutations (participants, items, assignments, payments, receipt scan, combined payments) also use `requireBillOwner` and often `assertBillDraft`; they are **not** bill-level lifecycle actions and are out of scope here except where the editor/summary UI triggers them indirectly.

---

## Finalize validation

Server: `assertBillCanFinalize` → `validateBillForFinalize` in `shared/bill-calculations.ts` (re-exported in `convex/lib/validateBillForFinalize.ts`).

| Code                  | Rule                                                         |
| --------------------- | ------------------------------------------------------------ |
| `missing_restaurant`  | Non-empty restaurant name (`isRestaurantReady`)              |
| `no_participants`     | At least one participant                                     |
| `no_items`            | At least one item with positive line total                   |
| `empty_units`         | Every unit on every item has an assignment                   |
| `unpaid_participants` | Every participant’s payment status is `paid` (host included) |

Client mirrors the same function in `BillSummaryContent` for disabled states and the error card. Step 4 completion in `shared/bill-step-completion.ts` additionally requires `finalizeReady && allPaid`.

**UI-only nuance:** When `unpaidCount > 0` and validation fails for other reasons, the primary finalize button shows a tooltip (“Всички гости трябва да платят…”) instead of the generic disabled state. The confirm dialog also disables “Завърши сметка” while `unpaidCount > 0`.

---

## UI surfaces

### `AppHeaderMenu` (`src/components/layout/app-header-menu.tsx`)

Shown when `showHostActions` (`AppHeader`: authenticated, not guest join/claim, not login). **No bill mutations.**

| Item                 | Action                                  |
| -------------------- | --------------------------------------- |
| Theme                | Light / dark / system                   |
| Профил               | Opens profile sheet                     |
| Настройки за плащане | Opens payment settings sheet            |
| Моите групи          | Opens friend groups sheet               |
| Помощ и напътствия   | `startReplay()` onboarding              |
| Изход                | Sign out (confirm via `getSignOutCopy`) |

### Home — `src/routes/index.tsx` + `BillCard`

| Control             | Mutation / behavior                                        | Eligibility                  |
| ------------------- | ---------------------------------------------------------- | ---------------------------- |
| **Нова сметка**     | `bills.create` → navigate to `/bills/$billId?step=1`       | Authenticated host           |
| Card tap            | Navigate: draft → editor, final → `/bills/$billId/summary` | Owner’s bills in list        |
| Card ⋮ → **Изтрий** | `bills.remove` + `getBillDeleteCopy` confirm               | Draft and final (no UI gate) |

### Bill editor — `src/routes/bills/$billId/index.tsx`

Host route: `useRequireHostAuth`. Final bills: `shouldRedirectFinalBillToSummary` forces step 4.

| Step | Bill-level actions                                                                                                                                    | Notes                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1    | Metadata → `bills.update` (debounced saves via `useBillEditorController`; receipt upload → `update` with `receiptStorageId` in `use-receipt-scan.ts`) | Draft only (server); final redirected away                                                |
| 2    | —                                                                                                                                                     | Participant CRUD is separate mutations; `ParticipantList` `readOnly={status === 'final'}` |
| 3    | **`BillInviteCard`**: share join link (client), **Обнови линка** → `rotateShareToken`                                                                 | Invite disabled if no participants; `readOnly` when final hides rotate                    |
| 4    | Embedded **`BillSummaryContent`**                                                                                                                     | See below                                                                                 |

Navigation: `StepNavBar` steps 1–4; header back from editor → home.

### Bill summary — `BillSummaryContent` (`src/components/bills/bill-summary-content.tsx`)

Used at `/bills/$billId/summary` and embedded in editor step 4 (`embedded` prop).

| Control                                | Mutation / behavior                            | Eligibility                                                                                       |
| -------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Завърши сметка**                     | `bills.finalize` + confirm dialog              | **Draft only**; disabled unless `validateBillForFinalize` passes; dialog blocked if unpaid guests |
| **Редактирай**                         | Navigate to editor step 1                      | Draft && !embedded                                                                                |
| **Изтрий**                             | `bills.remove` + confirm → home                | Draft and final                                                                                   |
| **Сподели сметка** (`ShareBillButton`) | Client text share/copy (`formatBillShareText`) | No status gate; no Convex call                                                                    |
| Payment settings banner                | Opens payment settings sheet                   | Draft && payment settings unconfigured                                                            |
| Payment rows                           | Participant payment mutations                  | `readOnly={!isDraft}` on rows                                                                     |

Header on summary: back goes to editor (draft) or home (final) — `app-header.tsx`.

### Share-related (join link vs export)

| Surface                      | Purpose                                                      | Backend                                                     |
| ---------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `BillInviteCard` step 3      | QR + **Сподели линк** (`?t=shareToken` join URL)             | Share is client-only; **Обнови линка** → `rotateShareToken` |
| `ShareBillButton` on summary | **Сподели сметка** — formatted breakdown text                | None                                                        |
| Onboarding                   | `interceptGuestShare` may gate first share during Напътствия | Records onboarding progress, not a bill mutation            |

Guest join/claim routes consume `shareToken` via `getForGuest`; rotating invalidates old links (server draft-only).

---

## Eligibility matrix (bill-level actions)

| Action             | Host only | Draft                      | Final                      | Validation / confirm                      |
| ------------------ | --------- | -------------------------- | -------------------------- | ----------------------------------------- |
| Create bill        | ✓         | —                          | —                          | —                                         |
| Update metadata    | ✓         | ✓                          | ✗ server                   | Field-level Zod on save                   |
| Finalize           | ✓         | ✓ UI                       | ✗ UI                       | `validateBillForFinalize`; confirm dialog |
| Delete bill        | ✓         | ✓                          | ✓                          | `getBillDeleteCopy`                       |
| Rotate share token | ✓         | ✓                          | ✗ server + UI (`readOnly`) | Inline dialog in `BillInviteCard`         |
| Share join link    | ✓         | ✓ (rotate hidden if final) | View-only invite card      | Client share API                          |
| Share bill text    | ✓         | ✓                          | ✓                          | Client only                               |

**Not implemented:** reopen / unfinalize, duplicate bill, rename from header, bill-level actions in `AppHeaderMenu`.

---

## Implications for header menu (#82)

- Today the ⋮ menu never exposes per-bill actions; delete/finalize/edit/share live on page content.
- **Delete** is the only bill action available from the home list; **finalize / edit / text share** only on summary; **join-link share / rotate** only on editor step 3.
- Any header menu matrix should reuse existing confirm copy (`src/lib/destructive-action-copy.ts`) and the same eligibility rules above.
- `finalize` server-side does not call `assertBillDraft` — header implementation should still restrict to draft in UI.

---

## Source files

| Area         | Files                                                                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Mutations    | `convex/bills.ts`, `convex/lib/assertBillDraft.ts`, `convex/lib/validateBillForFinalize.ts`, `convex/lib/auth.ts`                              |
| Validation   | `shared/bill-calculations.ts`, `shared/bill-step-completion.ts`, `shared/bill-readiness.ts`                                                    |
| Header       | `src/components/layout/app-header.tsx`, `src/components/layout/app-header-menu.tsx`                                                            |
| Home         | `src/routes/index.tsx`, `src/components/bills/bill-card.tsx`                                                                                   |
| Editor       | `src/routes/bills/$billId/index.tsx`, `src/hooks/use-bill-editor-controller.ts`, `src/hooks/use-receipt-scan.ts`                               |
| Summary      | `src/routes/bills/$billId/summary.tsx`, `src/components/bills/bill-summary-content.tsx`                                                        |
| Share        | `src/components/bills/bill-invite-card.tsx`, `src/components/bills/share-bill-button.tsx`, `src/lib/bill-join-url.ts`, `src/lib/share-link.ts` |
| Confirm copy | `src/lib/destructive-action-copy.ts`                                                                                                           |
