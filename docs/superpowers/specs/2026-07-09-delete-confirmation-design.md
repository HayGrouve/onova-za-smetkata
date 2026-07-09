# Delete Confirmation — Scoped Design

**Date:** 2026-07-09  
**Status:** ✅ Approved  
**Scope:** Confirmation dialog before every destructive action in the app

---

## Summary

Every destructive/red action in the app must show a confirmation dialog before executing. This includes server-side deletes, participant removals, guest claim unassignments, payment undo, local draft member removals, and sign-out.

The implementation uses a **shared `AlertDialog` + global confirm provider** (`useConfirmAction`) so heterogeneous triggers (trash icons, chip ✕ buttons, dropdown items, full-width buttons) share one dialog, one copy map, and one interaction model.

Post-delete **„Отмени" undo toasts** on items and participants remain unchanged — confirmation is an additional guard, not a replacement.

---

## Goals

1. **No accidental destructive actions** — user must explicitly confirm before any red/destructive control executes.
2. **Consistent UX** — same dialog layout, button order, loading state, and Bulgarian copy patterns everywhere.
3. **Single source of truth** — one provider, one copy map; no per-component duplicate dialog markup.
4. **Minimal mutation changes** — confirm wraps existing handlers; Convex mutations, validation, and undo logic stay as-is.

## Non-goals

- Confirmation for non-destructive actions (add, edit, navigate, share, finalize).
- „Don't ask again" / localStorage preference to skip confirmations.
- Mobile-specific dialog variant.
- Replacing post-delete undo toasts (kept for items and participants).
- The red „N неразпределени" badge in `item-list` (navigation, not delete).
- Finalize-bill dialog (not a delete action).

---

## Anchor decision: AlertDialog + confirm provider

**Chosen approach:** shadcn `AlertDialog` mounted once at app root via `ConfirmActionProvider`.

| Principle | Decision |
|-----------|----------|
| Dialog component | `AlertDialog` (semantic confirm/cancel; backdrop dismiss = cancel) |
| API | Imperative: `const confirmed = await confirm(options)` → `boolean` |
| Copy | Centralized in `src/lib/destructive-action-copy.ts` |
| Provider mount | `__root.tsx`, inside `ThemeProvider`, alongside `Toaster` |
| Existing bill-delete dialogs | Refactored to provider (remove local `Dialog` + `deleteOpen` state) |

**Why not per-screen `Dialog`?** Bill delete already uses this pattern twice (`bill-card`, `bill-summary-content`). Scaling to 11 touch points duplicates markup and drifts copy.

**Why not a `ConfirmDestructiveButton` wrapper?** Does not cover chip ✕ buttons, trash icons, or dropdown menu items without awkward composition.

---

## Action inventory

| # | Surface | Trigger | Has confirm today? | Post-action behavior |
|---|---------|---------|-------------------|---------------------|
| 1 | `bill-card` | Dropdown → Изтрий | ✅ Dialog | Navigate away |
| 2 | `bill-summary-content` | Изтрий button | ✅ Dialog | Navigate away |
| 3 | `item-list` | Trash icon per item | ❌ | Toast + „Отмени" (restore item) |
| 4 | `participant-list` | Chip ✕ | ❌ | Toast + „Отмени" (re-add participant) |
| 5 | `friend-group-editor-sheet` | „Изтрий групата" | ❌ | Close sheet |
| 6 | `friend-group-editor-sheet` | Member chip ✕ (local draft) | ❌ | Local state only; saved on „Запази" |
| 7 | `participant-breakdown-content` | Guest claim ✕ | ❌ | Assignment mutation |
| 8 | `payment-actions` | „Отмени последно плащане" | ❌ | Refresh payment list |
| 9 | `app-header-menu` | „Изход" (destructive menu item) | ❌ | Redirect to login |
| 10 | `index.tsx` (bill editor) | Receipt „Замени" | ✅ Dialog | Scan/import flow |

Item #10 may optionally migrate to the provider for consistency; copy is contextual enough that a dedicated dialog is acceptable if migration adds complexity.

---

## Provider API

```ts
type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string   // default: „Потвърди"
  cancelLabel?: string    // default: „Отказ"
  variant?: 'destructive' | 'default'  // confirm button styling; default: destructive
}

// Returns true if user confirmed, false if cancelled or dismissed
confirm(options: ConfirmOptions): Promise<boolean>
```

**Hook:** `useConfirmAction()` — throws if used outside provider.

**Provider behavior:**
- Only one dialog open at a time (new `confirm()` call while open resolves previous as `false` or queues — implement as reject/resolve previous pending promise as `false`).
- Confirm button: `variant="destructive"` by default; disabled + `aria-busy` while `onConfirm` async work runs.
- Dialog stays open until mutation resolves; closes on success or error.
- On error: close dialog, show existing error toast (`getConvexErrorMessage`).
- Double-click protection: confirm disabled after first click until resolved.
- Keyboard: Escape = cancel, Enter = confirm (AlertDialog default).

---

## Dialog layout

```
┌─────────────────────────────────────┐
│  [Title — question form]            │
│                                     │
│  [Description — 1–2 sentences]      │
│                                     │
│              [ Отказ ]  [ Confirm ] │
└─────────────────────────────────────┘
```

- Cancel: `variant="outline"`, label „Отказ", left side.
- Confirm: context-specific label, right side, destructive styling for delete/sign-out actions.
- Width: `max-w-lg`, centered — matches existing dialogs.
- Accessibility: `AlertDialogTitle` + `AlertDialogDescription`.

---

## Copy templates

Defined in `src/lib/destructive-action-copy.ts`. Each export returns `ConfirmOptions`.

| Action key | Title | Description | Confirm label |
|------------|-------|-------------|---------------|
| `bill.delete` | Изтриване на сметка? | Това действие е необратимо. Всички участници, артикули и плащания ще бъдат изтрити. | Изтрий сметката |
| `item.delete` | Изтриване на артикул? | „{name}" ще бъде премахнат от сметката. | Изтрий |
| `participant.remove` | Премахване на участник? | „{name}" и разпределенията му ще бъдат премахнати. | Премахни |
| `friendGroup.delete` | Изтриване на групата? | Групата „{name}" ще бъде изтрита завинаги. | Изтрий групата |
| `friendGroup.memberRemove` | Премахване от групата? | „{name}" ще бъде премахнат от списъка (промяната се записва при „Запази"). | Премахни |
| `claim.unassign` | Премахване на артикул? | „{name}" ще бъде премахнат от вашата част. | Премахни |
| `payment.undo` | Отмяна на последното плащане? | Последното записано плащане ще бъде отменено. | Отмени плащането |
| `auth.signOut` | Изход от профила? | Ще бъдете изведени от акаунта си. | Изход |
| `receipt.replace` | Ще изтриете съществуващите артикули | Артикулите имат разпределения между участници. Замяната ще изтрие съществуващите артикули и разпределенията им. Продължавате ли? | Замени |

---

## Per-site migration pattern

Existing handler logic is unchanged. A confirm guard is inserted before it:

```tsx
async function handleDeleteWithConfirm(item: Doc<'items'>) {
  const confirmed = await confirm(getItemDeleteCopy(item.name))
  if (!confirmed) return
  await handleDelete(item)  // existing mutation + undo toast
}
```

Trigger wiring changes from `onClick={() => void handleDelete(item)}` to `onClick={() => void handleDeleteWithConfirm(item)}`.

---

## Files

| File | Responsibility |
|------|----------------|
| `src/components/ui/alert-dialog.tsx` | **new** — shadcn AlertDialog primitives |
| `src/components/confirm-action-provider.tsx` | **new** — context, provider, hook, mounted dialog |
| `src/lib/destructive-action-copy.ts` | **new** — copy templates + `{name}` interpolation |
| `src/routes/__root.tsx` | Mount `ConfirmActionProvider` |
| `src/components/bills/bill-card.tsx` | Refactor delete → provider |
| `src/components/bills/bill-summary-content.tsx` | Refactor delete → provider |
| `src/components/bills/item-list.tsx` | Confirm before item delete |
| `src/components/bills/participant-list.tsx` | Confirm before participant remove |
| `src/components/bills/friend-group-editor-sheet.tsx` | Confirm group delete + member remove |
| `src/components/bills/participant-breakdown-content.tsx` | Confirm guest claim unassign |
| `src/components/bills/payment-actions.tsx` | Confirm payment undo |
| `src/components/layout/app-header-menu.tsx` | Confirm sign-out |

---

## Rollout order

1. Foundation — install `alert-dialog`, provider, copy map, mount in root.
2. Refactor existing bill-delete dialogs (`bill-card`, `bill-summary-content`) to validate provider.
3. Editor actions — `item-list`, `participant-list`.
4. Friend groups — group delete + member chip.
5. Guest & payments — claim unassign, payment undo.
6. Auth — sign-out confirm.
7. Optional — migrate receipt „Замени" dialog for consistency.

---

## Testing

### Unit tests

- `destructive-action-copy.test.ts` — all keys produce valid `ConfirmOptions`; `{name}` interpolation works; no empty titles.
- `confirm-action-provider.test.tsx` — render provider; `confirm()` opens dialog; cancel returns `false`; confirm returns `true`; confirm disabled while pending.

### Manual QA (each action × cancel + confirm)

1. **Cancel** — nothing happens, no toast, no mutation.
2. **Confirm** — mutation runs, success feedback unchanged from today.
3. **Confirm + server error** — dialog closes, error toast shown.
4. **Double-click confirm** — only one mutation fired.
5. **Item/participant delete** — undo toast still appears after confirmed delete.

### Exit criteria

- [x] All 9 new confirmation touch points wired (items 3–9 in inventory; 1–2 refactored; 10 optional).
- [x] No destructive action executes without passing through `confirm()`.
- [x] `pnpm run preflight` passes.
- [x] Manual QA checklist complete for light and dark mode.

---

## Self-review notes

- Scope is a single subsystem (confirm provider + wiring) — one implementation plan is sufficient.
- Receipt replace (#10) marked optional to avoid blocking on multi-step dialog edge cases.
- Provider handles concurrent calls by resolving stale promises as `false` when a new confirm opens.
- Sign-out included per user scope decision („literally every destructive/red action").
