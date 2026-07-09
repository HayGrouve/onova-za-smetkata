# Friend Groups (Scoped Design)

**Date:** 2026-07-09  
**Status:** Approved  
**Scope:** Saved name lists per host; quick add on bill editor + full CRUD in settings

---

## Problem

Hosts repeatedly add the same circle of people bill by bill. Recent-name chips help one-offs but not stable groups (work lunch, neighbors, etc.).

## Solution

Saved **friend groups** are reusable name templates. Adding a group **copies** names into `participants` (no live link). Complements recent-name chips and manual input.

## UX decisions

| Topic | Choice |
|-------|--------|
| Management | Bill inline + host settings (header menu) |
| Add group to bill | Tap = add all (skip duplicates, toast summary); ⋯ menu = preview sheet with checkboxes |
| Quick-create on bill | „+ Група“ dropdown: empty create + „Запази участниците“ when ≥2 on bill |

## Data model

```
friendGroups: {
  userId: Id<"users">
  name: string
  memberNames: string[]   // max 20, unique case-insensitive
  sortOrder: number
  updatedAt: number
}
.index("by_userId", ["userId"])
```

Host-scoped only. No guest access.

## Bill editor — „Участници“

1. Participant chips (unchanged)
2. **Групи** — horizontal scroll pills; tap adds all; ⋯ opens preview sheet
3. Recent names (unchanged)
4. Manual input (unchanged)

### „+ Група“ menu

- **Нова група** — empty editor sheet
- **Запази участниците като група** — pre-filled members when bill has ≥2 participants

### Preview sheet

Title: „Добави от: {name}“. Checkboxes per member; already on bill = checked + disabled („Вече добавен“). Actions: „Добави избраните (N)“, „Добави всички“.

### Toasts

- Partial success: „Добавени 4 · 1 вече на сметката“
- All skipped: „Всички от групата вече са добавени“

## Settings — „Моите групи“

Header menu entry (like payment settings). List with member count; tap to edit; „+ Нова група“; empty state copy.

## Server

- `friendGroups.list`, `get`, `create`, `update`, `remove`
- `friendGroups.addToBill({ billId, groupId, names? })` — bulk insert via shared duplicate-skip logic; `touchBill`

## Edge cases

| Case | Handling |
|------|----------|
| Empty group | Pill hidden |
| All members on bill | Toast only |
| Bill finalized | Hide group UI (read-only participants) |
| Guest pages | No groups |

## Out of scope (v1)

- Avatars / contacts import
- Shared groups between hosts
- Auto-update bill when group edits
- Drag-reorder groups on bill

## Files

| File | Action |
|------|--------|
| `convex/schema.ts` | `friendGroups` table |
| `convex/friendGroups.ts` | CRUD + addToBill |
| `shared/friend-group-schema.ts` | Validation |
| `src/components/bills/friend-groups-provider.tsx` | Context + sheets |
| `src/components/bills/friend-groups-sheet.tsx` | Settings list |
| `src/components/bills/friend-group-editor-sheet.tsx` | Create/edit |
| `src/components/bills/friend-group-add-preview-sheet.tsx` | Partial add |
| `src/components/bills/participant-list.tsx` | Groups section |
| `src/components/layout/app-header-menu.tsx` | Menu entry |
| `src/components/layout/app-shell.tsx` | Provider |
