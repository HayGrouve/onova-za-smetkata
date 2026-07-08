# Personal Bill Splitter — Design Spec

**Date:** 2026-07-07  
**Project:** onova-za-smetkata  
**Status:** Approved

## Summary

A personal mobile web PWA for splitting restaurant bills. One user creates bills, assigns items to people, tracks who owes what, and marks payments received. Manual entry only; EUR currency; Bulgarian UI.

## Decisions

| Decision       | Choice                                       |
| -------------- | -------------------------------------------- |
| Platform       | Mobile web PWA (TanStack Start + Convex)     |
| Auth           | None — single personal deployment            |
| Currency       | EUR (amounts stored as integer cents)        |
| Language       | Bulgarian UI (hardcoded for MVP)             |
| Bill editor    | Single scrolling page with sticky totals bar |
| Draft handling | Auto-save on every change (debounced)        |
| Architecture   | Convex-native (direct queries/mutations)     |

## Architecture

```
┌─────────────────────────────────────┐
│  TanStack Start (React + Router)    │
│  Shadcn UI + Tailwind               │
│  PWA manifest, mobile viewport      │
└──────────────┬──────────────────────┘
               │ useQuery / useMutation
┌──────────────▼──────────────────────┐
│  Convex                             │
│  - bills, participants, items       │
│  - itemAssignments, payments        │
│  - file storage (receipt photos)    │
└─────────────────────────────────────┘
```

**Security:** No authentication. Anyone with the deployment URL can access data. Acceptable for a private Netlify deployment.

**Offline:** MVP requires network for reads and writes. No offline editing.

## Screens (5)

### 1. Home (`/`)

- App title: „Онова за сметката“
- „Нова сметка“ button — creates draft bill, navigates to editor
- Search bar — filters by restaurant name or participant name
- Bill list — sorted by `updatedAt` desc
- Draft bills show „Чернова“ badge
- Final bills show restaurant, date, total, outstanding balance summary
- Tap bill → editor (draft) or summary (final)

### 2. Bill Editor (`/bills/$billId`)

Single scrolling page with sections:

1. **Header** — restaurant name, date (default now), optional note, receipt photo (camera/gallery)
2. **Participants** — add/remove names, duplicate names allowed (disambiguated in UI)
3. **Items** — name, unit price (EUR), quantity (default 1), optional note; add/edit/delete
4. **Assignment** — inline under each item: participant chip toggles (multi-select = equal split)

**Sticky totals bar** at bottom — per-person running totals; tap to expand breakdown.

Actions:

- „Преглед“ → navigate to summary (validation runs on summary)
- Auto-save debounced (~500ms) on every change

Hint text: „Добавете данък и бакшиш като отделни артикули.“

### 3. Bill Summary (`/bills/$billId/summary`)

- Bill total and per-person breakdown (owed / paid / balance)
- Validation errors if bill cannot be finalized
- „Завърши сметка“ — sets status to `final` (blocked if validation fails)
- Inline payment actions per person:
  - „Платено“ — mark full balance as paid
  - Partial payment — amount + optional note
- Payment status badges: неплатено / частично / платено

### 4. Bill Detail

Merged into Summary page. Final bills open directly on summary route. „Редактирай“ returns to editor; edits recalculate balances while preserving payment records.

### 5. History

Merged into Home. Search and list on home screen — no separate history route.

## Data Model (Convex)

### `bills`

| Field            | Type               | Notes                    |
| ---------------- | ------------------ | ------------------------ |
| restaurantName   | string             | Required before finalize |
| date             | number             | Unix ms timestamp        |
| note             | string?            | Optional                 |
| receiptStorageId | Id<"_storage">?    | Convex file storage      |
| status           | "draft" \| "final" |                          |
| createdAt        | number             |                          |
| updatedAt        | number             |                          |

**Indexes:** `by_status`, `by_updatedAt`

### `participants`

| Field     | Type        |
| --------- | ----------- |
| billId    | Id<"bills"> |
| name      | string      |
| sortOrder | number      |

**Index:** `by_billId`

### `items`

| Field          | Type        | Notes     |
| -------------- | ----------- | --------- |
| billId         | Id<"bills"> |           |
| name           | string      |           |
| unitPriceCents | number      | EUR cents |
| quantity       | number      | Default 1 |
| note           | string?     |           |
| sortOrder      | number      |           |

**Index:** `by_billId`

### `itemAssignments`

| Field         | Type               |
| ------------- | ------------------ |
| itemId        | Id<"items">        |
| participantId | Id<"participants"> |

Equal split computed at read time — no `assignedAmount` in MVP.

**Indexes:** `by_itemId`, `by_participantId`

### `payments`

| Field         | Type               |
| ------------- | ------------------ |
| billId        | Id<"bills">        |
| participantId | Id<"participants"> |
| amountCents   | number             |
| note          | string?            |
| paidAt        | number             |

**Index:** `by_billId`

## Business Rules

### Item pricing

```
lineTotalCents = unitPriceCents × quantity
billTotalCents = sum(lineTotalCents for all items)
```

### Equal split assignment

For an item assigned to N participants:

```
base = floor(lineTotalCents / N)
remainder = lineTotalCents % N
```

First `remainder` participants (by `sortOrder`) receive `base + 1` cent; rest receive `base` cent.

### Participant totals

```
owedCents = sum of assignment portions across all items
paidCents = sum of payment amountCents for participant
balanceCents = owedCents - paidCents
```

### Payment status

| Status    | Condition                 |
| --------- | ------------------------- |
| неплатено | paidCents === 0           |
| частично  | 0 < paidCents < owedCents |
| платено   | balanceCents <= 0         |

### Finalize validation

Block finalize unless:

- At least 1 participant
- At least 1 item with `lineTotalCents > 0`
- Every item has at least 1 assignment

Show Bulgarian error messages for each failure.

### Other rules

- **Tax/tip:** Manual line items only
- **Duplicate names:** Allowed; UI shows „Име (2)“ when duplicates exist on same bill
- **Edit after payment:** Allowed; payments preserved; balances recalculate
- **Delete bill:** Confirmation dialog; cascade delete participants, items, assignments, payments
- **Unassigned items:** Block finalize with warning
- **Zero-value items:** Allowed (useful as notes); excluded from totals

### Formatting

```typescript
new Intl.NumberFormat('bg-BG', { style: 'currency', currency: 'EUR' })
```

## UX Details

- **Undo:** Toast with 5-second undo for deleted items/participants only
- **Receipt photo:** `<input type="file" accept="image/*" capture="environment">` + Convex upload URL
- **PWA:** Update `manifest.json` — Bulgarian name, theme colors, standalone display
- **Root layout:** `lang="bg"`, mobile viewport, app title

## Out of Scope (MVP)

- OCR / receipt parsing
- Saved contacts
- Custom percentage or amount splits
- Multi-currency
- Authentication
- Export (PDF/CSV)
- Analytics dashboards
- Edit history log
- Cloud sync across accounts
- Bank / Revolut integration

## Acceptance Criteria

The MVP is complete when the user can:

1. Create a new bill (auto-saved as draft)
2. Attach a receipt photo
3. Add restaurant name, date, and notes
4. Add participants
5. Add items manually with price and quantity
6. Assign items to one or more participants (equal split)
7. See calculated per-person totals in real time
8. Finalize a bill after validation passes
9. Mark full or partial payments
10. Browse past bills on home screen
11. Search bills by person or restaurant
12. Edit and delete bills

## Build Order

1. Pure calculation module + tests
2. Convex schema + mutations/queries
3. Currency formatting utility
4. Home screen + bill list
5. Bill editor (participants, items, assignments, sticky bar)
6. Auto-save debounce layer
7. Summary + finalize + payments
8. Receipt photo upload
9. Search/filter
10. PWA polish + delete/undo
