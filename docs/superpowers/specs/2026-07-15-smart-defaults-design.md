# Smart Default Values — Tip Presets, Friend Group Pin, OCR Activity Bar

**Date:** 2026-07-15  
**Status:** Approved  
**Scope:** Bill edit page UX improvements — smarter tip input, last-used friend group pinning, global OCR progress feedback  
**Approach:** A — Lightweight client prefs (localStorage + focused components, no Convex schema changes)

---

## Problem

Three friction points on the bill edit flow slow down the host:

1. **Tip** — free-form EUR input forces mental math; most users pick standard percentages of the items total.
2. **Friend groups** — groups appear in static sort order; the group used most often requires horizontal scrolling to find.
3. **OCR** — upload and scan feedback is inline on the receipt card only; if the user scrolls away, it is unclear whether a scan is still running or they need to take another action.

## Solution

Add three small, isolated improvements on the bill edit page (`/bills/$billId`):

| Feature          | What changes                                                                       |
| ---------------- | ---------------------------------------------------------------------------------- |
| Tip presets      | 10% / 15% / 20% chips computed from items subtotal, plus existing custom EUR input |
| Friend group pin | Last tapped group moves to first chip position with subtle visual highlight        |
| OCR activity bar | Fixed top indeterminate progress bar during upload or scan                         |

No backend schema changes. Bill data still stores `tipCents` only; preferences live in `localStorage`.

## UX decisions

| Topic                 | Choice                                                                      |
| --------------------- | --------------------------------------------------------------------------- |
| Tip % base            | Items subtotal only (before tip is added)                                   |
| Tip default           | Remember last used % or custom amount (`localStorage`)                      |
| Tip UI                | Preset chips + custom EUR input (user can override any time)                |
| Tip on item change    | Active % chip auto-recalculates saved `tipCents`; custom amount stays fixed |
| Empty bill tip        | Chips disabled; helper text prompts user to add items first                 |
| Friend group behavior | Pin last-used group as first chip; user still taps to add (no auto-add)     |
| Friend group storage  | `localStorage` only (per device/browser)                                    |
| Friend group scope    | Bill participant picker only; management screen unchanged                   |
| OCR feedback          | Fixed top indeterminate progress bar + disabled scan/upload controls        |
| OCR scope             | All receipt scan paths (camera + gallery upload)                            |
| OCR page scope        | Bill edit page only                                                         |
| Form during OCR       | Rest of form stays editable while bar is visible                            |

## Approach comparison

### A — Lightweight client prefs (chosen)

- `tip-preferences-storage.ts`, `last-friend-group-storage.ts`, `TipField`, `OcrActivityBar`
- Matches existing `bill-advanced-settings-storage` pattern
- Zero Convex migrations; works offline for prefs
- Minimal re-renders via `useMemo`

### B — Unified `SmartDefaults` context (rejected)

- Single provider for tip, groups, OCR state
- Overkill for three unrelated features; risk of unnecessary re-renders

### C — Server-backed user preferences (rejected)

- `userPreferences` table + `lastUsedAt` on friend groups
- Syncs across devices but adds latency, auth edge cases, and scope disproportionate to a single-device PWA workflow

---

## Feature 1: Tip field

### UI

Replace the plain "Бакшиш" `<Input>` in `src/routes/bills/$billId/index.tsx` with a `TipField` component:

```
[ 10% · 2,40 € ] [ 15% · 3,60 € ] [ 20% · 4,80 € ]
[ Custom EUR input — same behavior as today        ]
Разделя се поравно между всички участници.
```

- Preset chips show **both** percentage and computed EUR amount
- Selected chip uses filled/primary variant; others outline
- Custom input below chips; typing deselects active chip
- Existing validation and debounced save to `bills.update` unchanged

### Calculation

```ts
tipCentsFromPercent = Math.round((itemsSubtotalCents * percent) / 100)
```

- `itemsSubtotalCents` derived from current bill items (same source as `calculateBillTotals`)
- Display amounts formatted with existing EUR helpers

### Preference storage

**File:** `src/lib/tip-preferences-storage.ts`

```ts
type TipPreference =
  | { mode: 'percent'; percent: 10 | 15 | 20 }
  | { mode: 'custom'; customCents: number }
```

**Key:** `tip-preference`

**Write:** On chip select or successful custom save  
**Read:** On bill load — apply preference to compute initial `tipCents` and UI state

### Behavior rules

| Event                                  | Action                                                              |
| -------------------------------------- | ------------------------------------------------------------------- |
| Bill load + stored % preference        | Select matching chip; compute and save `tipCents` if bill has items |
| Bill load + stored custom preference   | Fill custom input; no chip selected                                 |
| Chip tap                               | Select chip; compute `tipCents`; save preference + bill             |
| Custom input change                    | Deselect chip; save raw cents; store `{ mode: 'custom' }`           |
| Items subtotal changes + % chip active | Recompute `tipCents` and save                                       |
| Items subtotal changes + custom mode   | Display unchanged; saved cents unchanged                            |
| Zero items                             | Chips disabled; show "Добави артикули за да изчислиш бакшиш"        |

### Data model

No change — `bills.tipCents` remains the single source of truth for calculations across claim, summary, and payments.

---

## Feature 2: Last-used friend group pin

### Storage

**File:** `src/lib/last-friend-group-storage.ts`  
**Key:** `last-used-friend-group-id`  
**Value:** Convex `friendGroups` document ID string

### Write triggers

Update storage after any successful group-add action in `participant-list.tsx`:

- "Add all" chip tap (`handleAddGroupAll`)
- Partial add from "Избери участници" preview flow

### Display

In `participant-list.tsx`, after `api.friendGroups.list` resolves:

1. Read stored ID from `localStorage`
2. If ID matches a group in the list, move it to index 0
3. Remaining groups keep server `sortOrder` / name order
4. Pinned chip: solid border (vs dashed for others); optional small "Последна" label on that chip or above the row

### Edge cases

| Case                        | Behavior                                |
| --------------------------- | --------------------------------------- |
| No stored ID                | Normal server order                     |
| Stored ID deleted / invalid | Ignore; normal order                    |
| Only one group              | Same UI; that group is first regardless |
| Multiple tabs               | Last write wins (acceptable)            |

### Scope exclusions

- No auto-add on bill open
- No Convex `lastUsedAt` field
- No reorder in friend-group editor / settings screens

---

## Feature 3: OCR activity bar

### Hook changes

Extend `useReceiptScan` (`src/hooks/use-receipt-scan.ts`):

```ts
isOcrBusy = isUploading || isScanning
```

Export `isOcrBusy` alongside existing `isUploading` and `isScanning`.

### Component

**File:** `src/components/bills/ocr-activity-bar.tsx`

- Renders when `isOcrBusy` is true
- `position: fixed; top: 0; left: 0; right: 0; z-index: 50`
- ~3px indeterminate progress animation (CSS only; `motion-reduce:animate-none`)
- Label: "Качване…" when `isUploading`; "Разпознаване…" when `isScanning` (upload label takes priority if both briefly overlap)
- Accessibility: `role="progressbar"`, `aria-valuetext`, `aria-live="polite"`

### Mount point

`src/routes/bills/$billId/index.tsx` — one instance at page level, outside the receipt card.

While visible, add top padding/spacer so fixed content is not obscured.

### Interaction

| Control                            | While busy |
| ---------------------------------- | ---------- |
| Gallery / camera buttons           | Disabled   |
| "Разпознай артикули" button        | Disabled   |
| Tip, participants, items, metadata | Editable   |

### Existing feedback (retained)

- Inline button spinner + "Разпознаване…" text on scan button
- Receipt image `receipt-scan-image-active` pulse border during scan
- Error toasts on upload/scan failure (unchanged)

### Performance

- One conditional DOM node; no timers or extra polling
- Animation via CSS transforms/keyframes only
- Existing Convex `receiptScan.getLatestScan` subscription drives scan state

---

## File map

| File                                        | Change                                      |
| ------------------------------------------- | ------------------------------------------- |
| `src/lib/tip-preferences-storage.ts`        | New — read/write tip preference             |
| `src/lib/last-friend-group-storage.ts`      | New — read/write last group ID              |
| `src/components/bills/tip-field.tsx`        | New — preset chips + custom input           |
| `src/components/bills/ocr-activity-bar.tsx` | New — fixed indeterminate bar               |
| `src/hooks/use-receipt-scan.ts`             | Export `isOcrBusy`                          |
| `src/routes/bills/$billId/index.tsx`        | Wire `TipField`, `OcrActivityBar`           |
| `src/components/bills/participant-list.tsx` | Reorder chips; write last-used on add       |
| `src/styles.css`                            | Indeterminate bar keyframes (if not inline) |

## Testing

### Unit

- `tip-preferences-storage` — read/write round-trip, invalid JSON fallback
- `last-friend-group-storage` — read/write, missing ID handling
- Tip percent → cents calculation (edge: rounding, zero subtotal)
- Friend group reorder logic (pinned first, rest preserved, invalid ID ignored)

### Component / integration

- `TipField` — chip select updates cents; custom input deselects chip; % recalc on subtotal change
- `OcrActivityBar` — visible when `isOcrBusy`; correct label per phase; a11y attributes

### Manual

- Open bill → last tip preference applied
- Add items → % chips show live amounts
- Tap friend group → group pins first on next bill
- Upload receipt → top bar shows "Качване…"
- Start scan → bar shows "Разпознаване…"; scroll away — bar still visible
- Scan completes / fails → bar hides

## Out of scope

- Cross-device preference sync
- Additional tip presets (e.g. 18%, 25%)
- Auto-adding last friend group to new bills
- Staged/progress-percent OCR (upload → scan → parse)
- OCR activity bar on claim or summary routes
- Guest-facing tip or friend-group changes
