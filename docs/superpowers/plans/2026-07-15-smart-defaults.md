# Smart Default Values Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tip percentage presets, last-used friend group pinning, and a fixed OCR activity bar on the bill edit page using lightweight `localStorage` preferences.

**Architecture:** Three isolated features with no Convex schema changes. Pure helpers + storage modules are tested with Vitest. UI components (`TipField`, `OcrActivityBar`) wire into existing bill edit route. Bill data still stores only `tipCents`; preferences are UI-layer only.

**Tech Stack:** TanStack Start, React 19, Convex, Shadcn UI (`Button`, `Input`, `Label`), Vitest

**Spec:** `docs/superpowers/specs/2026-07-15-smart-defaults-design.md`

## Global Constraints

- No Convex schema changes; `bills.tipCents` remains the calculation source of truth
- Tip % base: items subtotal only (sum of item line totals, before tip)
- Tip default: remember last used % or custom amount in `localStorage`
- Tip UI: 10% / 15% / 20% chips + custom EUR input
- Active % chip auto-recalculates `tipCents` when items subtotal changes; custom amount stays fixed
- Friend group: pin last-used group as first chip; user still taps to add (no auto-add)
- Friend group storage: `localStorage` only; bill participant picker scope only
- OCR: fixed top indeterminate progress bar when `isUploading || isScanning`
- OCR scope: bill edit page only; gallery + camera upload paths
- Copy language: Bulgarian UI strings
- Amounts: EUR integer cents only
- Out of scope: cross-device sync, extra tip presets, auto-add groups, staged OCR %, claim/summary routes

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/tip-preferences-storage.ts` | Read/write tip preference (`percent` or `custom`) |
| `src/lib/tip-preferences-storage.test.ts` | Storage round-trip + invalid JSON |
| `shared/tip-calculations.ts` | Pure tip % → cents + items subtotal helper |
| `shared/tip-calculations.test.ts` | Vitest for tip math |
| `src/components/bills/tip-field.tsx` | Preset chips + custom input UI |
| `src/lib/last-friend-group-storage.ts` | Read/write last-used group ID |
| `src/lib/last-friend-group-storage.test.ts` | Storage tests |
| `src/lib/sort-friend-groups-with-pinned.ts` | Pure reorder helper |
| `src/lib/sort-friend-groups-with-pinned.test.ts` | Reorder edge cases |
| `src/components/bills/participant-list.tsx` | Pinned chip UI + write on add-all |
| `src/components/bills/friend-group-add-preview-sheet.tsx` | Write last-used on partial add |
| `src/hooks/use-receipt-scan.ts` | Export `isOcrBusy` |
| `src/components/bills/ocr-activity-bar.tsx` | Fixed indeterminate bar |
| `src/styles.css` | `ocr-activity-indeterminate` keyframes |
| `src/routes/bills/$billId/index.tsx` | Wire `TipField`, `OcrActivityBar`, items subtotal |

---

### Task 1: Tip preference storage (TDD)

**Files:**
- Create: `src/lib/tip-preferences-storage.ts`
- Create: `src/lib/tip-preferences-storage.test.ts`

**Interfaces:**
- Produces:
  - `TIP_PREFERENCE_KEY` — `'tip-preference'`
  - `type TipPercent = 10 | 15 | 20`
  - `type TipPreference = { mode: 'percent'; percent: TipPercent } | { mode: 'custom'; customCents: number }`
  - `readTipPreference(): TipPreference | null`
  - `writeTipPreference(pref: TipPreference): void`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/tip-preferences-storage.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  TIP_PREFERENCE_KEY,
  readTipPreference,
  writeTipPreference,
} from './tip-preferences-storage'

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

describe('tip-preferences-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when unset', () => {
    expect(readTipPreference()).toBeNull()
  })

  it('persists percent preference', () => {
    writeTipPreference({ mode: 'percent', percent: 15 })
    expect(readTipPreference()).toEqual({ mode: 'percent', percent: 15 })
    expect(localStorage.getItem(TIP_PREFERENCE_KEY)).toBe(
      JSON.stringify({ mode: 'percent', percent: 15 }),
    )
  })

  it('persists custom preference', () => {
    writeTipPreference({ mode: 'custom', customCents: 350 })
    expect(readTipPreference()).toEqual({ mode: 'custom', customCents: 350 })
  })

  it('returns null for invalid JSON', () => {
    localStorage.setItem(TIP_PREFERENCE_KEY, '{bad')
    expect(readTipPreference()).toBeNull()
  })

  it('returns null for unknown shape', () => {
    localStorage.setItem(TIP_PREFERENCE_KEY, JSON.stringify({ mode: 'nope' }))
    expect(readTipPreference()).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/tip-preferences-storage.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/tip-preferences-storage.ts
export const TIP_PREFERENCE_KEY = 'tip-preference'

export type TipPercent = 10 | 15 | 20

export type TipPreference =
  | { mode: 'percent'; percent: TipPercent }
  | { mode: 'custom'; customCents: number }

const TIP_PERCENTS = new Set<TipPercent>([10, 15, 20])

function isTipPercent(value: unknown): value is TipPercent {
  return typeof value === 'number' && TIP_PERCENTS.has(value as TipPercent)
}

function parseTipPreference(raw: unknown): TipPreference | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  if (record.mode === 'percent' && isTipPercent(record.percent)) {
    return { mode: 'percent', percent: record.percent }
  }
  if (
    record.mode === 'custom' &&
    typeof record.customCents === 'number' &&
    Number.isInteger(record.customCents) &&
    record.customCents >= 0
  ) {
    return { mode: 'custom', customCents: record.customCents }
  }
  return null
}

export function readTipPreference(): TipPreference | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(TIP_PREFERENCE_KEY)
  if (!raw) return null
  try {
    return parseTipPreference(JSON.parse(raw))
  } catch {
    return null
  }
}

export function writeTipPreference(pref: TipPreference): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(TIP_PREFERENCE_KEY, JSON.stringify(pref))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/tip-preferences-storage.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/tip-preferences-storage.ts src/lib/tip-preferences-storage.test.ts
git commit -m "feat: add tip preference localStorage helpers"
```

---

### Task 2: Tip calculation helpers (TDD)

**Files:**
- Create: `shared/tip-calculations.ts`
- Create: `shared/tip-calculations.test.ts`

**Interfaces:**
- Consumes: `lineTotalCents`, `ItemInput` from `shared/bill-calculations.ts`
- Produces:
  - `TIP_PRESETS: readonly TipPercent[]` — `[10, 15, 20]`
  - `tipCentsFromPercent(itemsSubtotalCents: number, percent: TipPercent): number`
  - `calculateItemsSubtotalCents(items: ItemInput[]): number`
  - `formatEurInputValue(cents: number): string`
  - `resolveInitialTipCents(pref: TipPreference | null, itemsSubtotalCents: number): number`

- [ ] **Step 1: Write the failing test**

```ts
// shared/tip-calculations.test.ts
import { describe, expect, it } from 'vitest'
import {
  calculateItemsSubtotalCents,
  formatEurInputValue,
  resolveInitialTipCents,
  tipCentsFromPercent,
} from './tip-calculations'

describe('tipCentsFromPercent', () => {
  it('rounds to nearest cent', () => {
    expect(tipCentsFromPercent(1001, 10)).toBe(100)
    expect(tipCentsFromPercent(333, 15)).toBe(50)
  })

  it('returns 0 for zero subtotal', () => {
    expect(tipCentsFromPercent(0, 20)).toBe(0)
  })
})

describe('calculateItemsSubtotalCents', () => {
  it('sums line totals', () => {
    expect(
      calculateItemsSubtotalCents([
        { id: 'a', unitPriceCents: 500, quantity: 2 },
        { id: 'b', unitPriceCents: 300, quantity: 1 },
      ]),
    ).toBe(1300)
  })
})

describe('formatEurInputValue', () => {
  it('formats cents for Bulgarian input', () => {
    expect(formatEurInputValue(1250)).toBe('12,50')
    expect(formatEurInputValue(0)).toBe('')
  })
})

describe('resolveInitialTipCents', () => {
  it('computes from percent preference', () => {
    expect(
      resolveInitialTipCents({ mode: 'percent', percent: 15 }, 2000),
    ).toBe(300)
  })

  it('uses custom cents when stored', () => {
    expect(
      resolveInitialTipCents({ mode: 'custom', customCents: 400 }, 2000),
    ).toBe(400)
  })

  it('returns 0 when no preference', () => {
    expect(resolveInitialTipCents(null, 2000)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test shared/tip-calculations.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
// shared/tip-calculations.ts
import { lineTotalCents, type ItemInput } from './bill-calculations'

export type TipPercent = 10 | 15 | 20

export type TipPreference =
  | { mode: 'percent'; percent: TipPercent }
  | { mode: 'custom'; customCents: number }

export const TIP_PRESETS: readonly TipPercent[] = [10, 15, 20]

export function tipCentsFromPercent(
  itemsSubtotalCents: number,
  percent: TipPercent,
): number {
  if (itemsSubtotalCents <= 0) return 0
  return Math.round((itemsSubtotalCents * percent) / 100)
}

export function calculateItemsSubtotalCents(items: ItemInput[]): number {
  return items.reduce((sum, item) => sum + lineTotalCents(item), 0)
}

export function formatEurInputValue(cents: number): string {
  if (cents === 0) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function resolveInitialTipCents(
  pref: TipPreference | null,
  itemsSubtotalCents: number,
): number {
  if (!pref) return 0
  if (pref.mode === 'percent') {
    return tipCentsFromPercent(itemsSubtotalCents, pref.percent)
  }
  return pref.customCents
}
```

**Note:** `TipPercent` / `TipPreference` types are defined in both `shared/tip-calculations.ts` (for pure helpers) and `src/lib/tip-preferences-storage.ts` (for storage). Shapes must stay identical.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test shared/tip-calculations.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add shared/tip-calculations.ts shared/tip-calculations.test.ts
git commit -m "feat: add shared tip percent calculation helpers"
```

---

### Task 3: TipField component + bill page wiring

**Files:**
- Create: `src/components/bills/tip-field.tsx`
- Modify: `src/routes/bills/$billId/index.tsx` (replace tip `<Input>` block ~L405–428; add `itemsSubtotalCents` memo; apply preference on bill load)

**Interfaces:**
- Consumes:
  - `readTipPreference`, `writeTipPreference`, `TipPercent`, `TipPreference` from `src/lib/tip-preferences-storage.ts`
  - `TIP_PRESETS`, `tipCentsFromPercent`, `formatEurInputValue`, `resolveInitialTipCents` from `shared/tip-calculations.ts`
  - `formatEur` from `src/lib/format-currency.ts`
  - `parseTipInputToCents` from `src/lib/bill-metadata-schema.ts`
- Produces:
  - `TipField` component with props:
    ```ts
    interface TipFieldProps {
      itemsSubtotalCents: number
      value: string
      onValueChange: (value: string) => void
      onValidCents: (cents: number) => void
      error?: string
      onClearError?: () => void
    }
    ```

- [ ] **Step 1: Create TipField component**

```tsx
// src/components/bills/tip-field.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { parseTipInputToCents } from '#/lib/bill-metadata-schema.ts'
import {
  readTipPreference,
  writeTipPreference,
  type TipPercent,
} from '#/lib/tip-preferences-storage.ts'
import {
  formatEurInputValue,
  TIP_PRESETS,
  tipCentsFromPercent,
} from '../../../shared/tip-calculations.ts'
import { cn } from '#/lib/utils.ts'

export interface TipFieldProps {
  itemsSubtotalCents: number
  value: string
  onValueChange: (value: string) => void
  onValidCents: (cents: number) => void
  error?: string
  onClearError?: () => void
}

export function TipField({
  itemsSubtotalCents,
  value,
  onValueChange,
  onValidCents,
  error,
  onClearError,
}: TipFieldProps) {
  const [selectedPercent, setSelectedPercent] = useState<TipPercent | null>(
    null,
  )
  const appliedPreferenceRef = useRef(false)

  const chipsDisabled = itemsSubtotalCents <= 0

  const chipAmounts = useMemo(
    () =>
      TIP_PRESETS.map((percent) => ({
        percent,
        cents: tipCentsFromPercent(itemsSubtotalCents, percent),
      })),
    [itemsSubtotalCents],
  )

  useEffect(() => {
    if (appliedPreferenceRef.current) return
    appliedPreferenceRef.current = true
    const pref = readTipPreference()
    if (!pref || itemsSubtotalCents <= 0) return
    if (pref.mode === 'percent') {
      setSelectedPercent(pref.percent)
      const cents = tipCentsFromPercent(itemsSubtotalCents, pref.percent)
      onValueChange(formatEurInputValue(cents))
      onValidCents(cents)
      return
    }
    setSelectedPercent(null)
    onValueChange(formatEurInputValue(pref.customCents))
    onValidCents(pref.customCents)
  }, [itemsSubtotalCents, onValueChange, onValidCents])

  useEffect(() => {
    if (selectedPercent === null || itemsSubtotalCents <= 0) return
    const cents = tipCentsFromPercent(itemsSubtotalCents, selectedPercent)
    onValueChange(formatEurInputValue(cents))
    onValidCents(cents)
  }, [itemsSubtotalCents, selectedPercent, onValueChange, onValidCents])

  function handlePercentSelect(percent: TipPercent) {
    setSelectedPercent(percent)
    writeTipPreference({ mode: 'percent', percent })
    const cents = tipCentsFromPercent(itemsSubtotalCents, percent)
    onValueChange(formatEurInputValue(cents))
    onClearError?.()
    onValidCents(cents)
  }

  function handleCustomChange(next: string) {
    setSelectedPercent(null)
    onValueChange(next)
    onClearError?.()
    const parsed = parseTipInputToCents(next)
    if (parsed.ok) {
      writeTipPreference({ mode: 'custom', customCents: parsed.cents })
      onValidCents(parsed.cents)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="tip">Бакшиш</Label>
      <div className="flex flex-wrap gap-2">
        {chipAmounts.map(({ percent, cents }) => (
          <Button
            key={percent}
            type="button"
            size="sm"
            variant={selectedPercent === percent ? 'default' : 'outline'}
            disabled={chipsDisabled}
            className={cn('h-9 px-3')}
            onClick={() => handlePercentSelect(percent)}
          >
            {percent}% · {formatEur(cents)}
          </Button>
        ))}
      </div>
      <Input
        id="tip"
        inputMode="decimal"
        value={value}
        onChange={(e) => handleCustomChange(e.target.value)}
        placeholder="0,00"
        className="h-11"
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : chipsDisabled ? (
        <p className="text-xs text-muted-foreground">
          Добави артикули за да изчислиш бакшиш.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Разделя се поравно между всички участници.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire TipField into bill edit page**

In `src/routes/bills/$billId/index.tsx`:

1. Add imports:
```ts
import { TipField } from '#/components/bills/tip-field.tsx'
import { calculateItemsSubtotalCents } from '../../../shared/tip-calculations.ts'
```

2. Remove local `formatEurInputValue` function (lines 86–89) — use shared helper via TipField internally; keep bill page using `formatEurInputValue` from shared for bill sync effect:

```ts
import {
  calculateItemsSubtotalCents,
  formatEurInputValue,
} from '../../../shared/tip-calculations.ts'
```

3. Add items subtotal memo after `labels` memo (~L229):
```ts
const itemsSubtotalCents = useMemo(
  () =>
    calculateItemsSubtotalCents(
      items.map((i) => ({
        id: i._id,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
      })),
    ),
  [items],
)
```

4. Add stable save callback for TipField:
```ts
const handleTipValidCents = useCallback(
  (cents: number) => {
    scheduleSave({ tipCents: cents })
  },
  [billId],
)
```

Wrap `scheduleSave` in `useCallback` if needed, or inline:
```ts
function handleTipValidCents(cents: number) {
  scheduleSave({ tipCents: cents })
}
```

5. Replace the tip `<div>` block (Label + Input + helper text) with:
```tsx
<TipField
  itemsSubtotalCents={itemsSubtotalCents}
  value={tip}
  onValueChange={(value) => {
    setTip(value)
    if (fieldErrors.tip) clearFieldError('tip')
    const validated = validateBillMetadataField('tip', value)
    if (!validated.ok) {
      setFieldErrors((prev) => ({ ...prev, tip: validated.message }))
      return
    }
    clearFieldError('tip')
  }}
  onValidCents={handleTipValidCents}
  error={fieldErrors.tip}
  onClearError={() => clearFieldError('tip')}
/>
```

**Important:** Remove the old `scheduleValidatedSave('tip', value)` from tip onChange — `TipField` calls `onValidCents` which saves directly. Custom invalid input still sets field error via `onValueChange` validation path above.

6. Update bill-switch `useEffect` to reset `appliedPreferenceRef` behavior by keying `TipField` on `bill._id`:
```tsx
<TipField key={bill._id} ... />
```

- [ ] **Step 3: Run tests and typecheck**

Run: `pnpm test`
Expected: all existing tests PASS

Run: `pnpm run build`
Expected: build succeeds

- [ ] **Step 4: Manual smoke check**

1. Open bill with items → tip chips show amounts
2. Tap 15% → input updates, totals include tip
3. Reload page → 15% still selected
4. Type custom amount → chip deselects, reload restores custom

- [ ] **Step 5: Commit**

```bash
git add src/components/bills/tip-field.tsx src/routes/bills/$billId/index.tsx
git commit -m "feat: add tip preset chips on bill edit page"
```

---

### Task 4: Friend group pin storage + sort helper (TDD)

**Files:**
- Create: `src/lib/last-friend-group-storage.ts`
- Create: `src/lib/last-friend-group-storage.test.ts`
- Create: `src/lib/sort-friend-groups-with-pinned.ts`
- Create: `src/lib/sort-friend-groups-with-pinned.test.ts`

**Interfaces:**
- Produces:
  - `LAST_FRIEND_GROUP_KEY` — `'last-used-friend-group-id'`
  - `readLastFriendGroupId(): string | null`
  - `writeLastFriendGroupId(groupId: string): void`
  - `sortFriendGroupsWithPinned<T extends { _id: string }>(groups: T[], pinnedId: string | null): { groups: T[]; pinnedId: string | null }`

- [ ] **Step 1: Write failing storage tests**

```ts
// src/lib/last-friend-group-storage.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  LAST_FRIEND_GROUP_KEY,
  readLastFriendGroupId,
  writeLastFriendGroupId,
} from './last-friend-group-storage'

function createStorage(): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
  }
}

describe('last-friend-group-storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorage())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null when unset', () => {
    expect(readLastFriendGroupId()).toBeNull()
  })

  it('persists group id', () => {
    writeLastFriendGroupId('groups_abc')
    expect(readLastFriendGroupId()).toBe('groups_abc')
    expect(localStorage.getItem(LAST_FRIEND_GROUP_KEY)).toBe('groups_abc')
  })
})
```

- [ ] **Step 2: Write failing sort tests**

```ts
// src/lib/sort-friend-groups-with-pinned.test.ts
import { describe, expect, it } from 'vitest'
import { sortFriendGroupsWithPinned } from './sort-friend-groups-with-pinned'

const groups = [
  { _id: 'a', name: 'Alpha' },
  { _id: 'b', name: 'Beta' },
  { _id: 'c', name: 'Gamma' },
]

describe('sortFriendGroupsWithPinned', () => {
  it('returns original order when pinnedId is null', () => {
    expect(sortFriendGroupsWithPinned(groups, null)).toEqual({
      groups,
      pinnedId: null,
    })
  })

  it('moves pinned group to front', () => {
    expect(sortFriendGroupsWithPinned(groups, 'c')).toEqual({
      groups: [
        { _id: 'c', name: 'Gamma' },
        { _id: 'a', name: 'Alpha' },
        { _id: 'b', name: 'Beta' },
      ],
      pinnedId: 'c',
    })
  })

  it('ignores invalid pinned id', () => {
    expect(sortFriendGroupsWithPinned(groups, 'missing')).toEqual({
      groups,
      pinnedId: null,
    })
  })

  it('keeps order when pinned is already first', () => {
    expect(sortFriendGroupsWithPinned(groups, 'a')).toEqual({
      groups,
      pinnedId: 'a',
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test src/lib/last-friend-group-storage.test.ts src/lib/sort-friend-groups-with-pinned.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 4: Implement storage + sort**

```ts
// src/lib/last-friend-group-storage.ts
export const LAST_FRIEND_GROUP_KEY = 'last-used-friend-group-id'

export function readLastFriendGroupId(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(LAST_FRIEND_GROUP_KEY)
}

export function writeLastFriendGroupId(groupId: string): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LAST_FRIEND_GROUP_KEY, groupId)
}
```

```ts
// src/lib/sort-friend-groups-with-pinned.ts
export function sortFriendGroupsWithPinned<T extends { _id: string }>(
  groups: T[],
  pinnedId: string | null,
): { groups: T[]; pinnedId: string | null } {
  if (!pinnedId) return { groups, pinnedId: null }
  const index = groups.findIndex((group) => group._id === pinnedId)
  if (index < 0) return { groups, pinnedId: null }
  if (index === 0) return { groups, pinnedId }
  const next = [...groups]
  const [pinned] = next.splice(index, 1)
  next.unshift(pinned)
  return { groups: next, pinnedId }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/lib/last-friend-group-storage.test.ts src/lib/sort-friend-groups-with-pinned.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add src/lib/last-friend-group-storage.ts src/lib/last-friend-group-storage.test.ts src/lib/sort-friend-groups-with-pinned.ts src/lib/sort-friend-groups-with-pinned.test.ts
git commit -m "feat: add last-used friend group storage and sort helper"
```

---

### Task 5: Friend group pin UI + write triggers

**Files:**
- Modify: `src/components/bills/participant-list.tsx`
- Modify: `src/components/bills/friend-group-add-preview-sheet.tsx`

**Interfaces:**
- Consumes: `readLastFriendGroupId`, `writeLastFriendGroupId`, `sortFriendGroupsWithPinned`

- [ ] **Step 1: Reorder groups and highlight pinned chip in participant-list**

In `src/components/bills/participant-list.tsx`:

1. Add imports:
```ts
import { useMemo } from 'react' // already imported
import { readLastFriendGroupId, writeLastFriendGroupId } from '#/lib/last-friend-group-storage.ts'
import { sortFriendGroupsWithPinned } from '#/lib/sort-friend-groups-with-pinned.ts'
import { cn } from '#/lib/utils.ts'
```

2. After `const friendGroups = useQuery(...)` add:
```ts
const { groups: orderedFriendGroups, pinnedId: pinnedGroupId } = useMemo(() => {
  if (!friendGroups) return { groups: [], pinnedId: null }
  return sortFriendGroupsWithPinned(friendGroups, readLastFriendGroupId())
}, [friendGroups])
```

3. Replace `friendGroups?.map` with `orderedFriendGroups.map`.

4. Update chip wrapper className:
```tsx
<div
  key={group._id}
  className={cn(
    'flex shrink-0 items-stretch overflow-hidden rounded-full border',
    group._id === pinnedGroupId ? 'border-solid border-primary/50' : 'border-dashed',
  )}
>
```

5. Add "Последна" label inside pinned chip button:
```tsx
<Button ...>
  {group._id === pinnedGroupId ? (
    <span className="flex items-center gap-1.5 truncate">
      <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
        Последна
      </span>
      <span className="truncate">{group.name}</span>
    </span>
  ) : (
    group.name
  )}
</Button>
```

6. Write last-used on successful add-all:
```ts
async function handleAddGroupAll(group: FriendGroupPreview) {
  try {
    const result = await addGroupToBill({ billId, groupId: group._id })
    writeLastFriendGroupId(group._id)
    toast.success(summarizeAddMembersToBill(result))
  } catch (error) {
    toast.error(getConvexErrorMessage(error))
  }
}
```

- [ ] **Step 2: Write last-used on partial add in preview sheet**

In `src/components/bills/friend-group-add-preview-sheet.tsx`:

1. Import:
```ts
import { writeLastFriendGroupId } from '#/lib/last-friend-group-storage.ts'
```

2. In `handleAdd`, after successful `addToBill`:
```ts
writeLastFriendGroupId(group._id)
```

- [ ] **Step 3: Run tests**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: Manual smoke check**

1. Add participants from group B → reload bill → group B is first with "Последна"
2. Partial add from group A → group A becomes pinned

- [ ] **Step 5: Commit**

```bash
git add src/components/bills/participant-list.tsx src/components/bills/friend-group-add-preview-sheet.tsx
git commit -m "feat: pin last-used friend group in participant picker"
```

---

### Task 6: OCR activity bar

**Files:**
- Modify: `src/hooks/use-receipt-scan.ts`
- Create: `src/components/bills/ocr-activity-bar.tsx`
- Modify: `src/styles.css`
- Modify: `src/routes/bills/$billId/index.tsx`

**Interfaces:**
- Produces:
  - `isOcrBusy: boolean` from `useReceiptScan`
  - `OcrActivityBar({ isUploading, isScanning }: { isUploading: boolean; isScanning: boolean })`

- [ ] **Step 1: Export isOcrBusy from hook**

In `src/hooks/use-receipt-scan.ts`, before `return {`:

```ts
const isOcrBusy = isUploading || isScanning
```

Add to return object:
```ts
isOcrBusy,
```

- [ ] **Step 2: Add CSS animation**

In `src/styles.css`, inside the existing `@layer utilities` block (near `.receipt-scan-image-active`):

```css
@keyframes ocr-activity-indeterminate {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(250%);
  }
}

.ocr-activity-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  height: 3px;
  overflow: hidden;
  background: color-mix(in oklab, var(--primary) 12%, transparent);
}

.ocr-activity-bar__track {
  height: 100%;
  width: 40%;
  background: var(--primary);
  animation: ocr-activity-indeterminate 1.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .ocr-activity-bar__track {
    animation: none;
    width: 100%;
    opacity: 0.6;
  }
}
```

- [ ] **Step 3: Create OcrActivityBar component**

```tsx
// src/components/bills/ocr-activity-bar.tsx
export interface OcrActivityBarProps {
  isUploading: boolean
  isScanning: boolean
}

export function OcrActivityBar({
  isUploading,
  isScanning,
}: OcrActivityBarProps) {
  const busy = isUploading || isScanning
  if (!busy) return null

  const label = isUploading ? 'Качване…' : 'Разпознаване…'

  return (
    <div
      className="ocr-activity-bar"
      role="progressbar"
      aria-valuetext={label}
      aria-live="polite"
    >
      <div className="ocr-activity-bar__track" />
      <span className="sr-only">{label}</span>
    </div>
  )
}
```

- [ ] **Step 4: Wire into bill edit page**

In `src/routes/bills/$billId/index.tsx`:

1. Import:
```ts
import { OcrActivityBar } from '#/components/bills/ocr-activity-bar.tsx'
```

2. Destructure `isOcrBusy` from `useReceiptScan`:
```ts
const {
  ...
  isUploading,
  isScanning,
  isOcrBusy,
  ...
} = useReceiptScan({ billId, items, assignments })
```

3. At top of `BillEditorContent` return JSX (inside fragment/page container):
```tsx
<OcrActivityBar isUploading={isUploading} isScanning={isScanning} />
```

4. Add conditional top padding to page container when busy:
```tsx
<div className={cn('page-container flex flex-col gap-4', isOcrBusy && 'pt-1')}>
```

5. Disable scan button when `isOcrBusy` (not just `isScanning`) — update existing disabled:
```tsx
disabled={isOcrBusy}
aria-busy={isOcrBusy}
```

Gallery/camera buttons already use `disabled={isUploading}` — change to `disabled={isOcrBusy}` so they stay disabled during scan too (matches spec table).

- [ ] **Step 5: Run verification**

Run: `pnpm test`
Expected: PASS

Run: `pnpm run build`
Expected: PASS

- [ ] **Step 6: Manual smoke check**

1. Upload receipt image → fixed top bar visible with "Качване…" (sr-only)
2. Tap "Разпознай артикули" → bar stays visible during scan
3. Scroll down → bar still fixed at top
4. Scan completes → bar disappears

- [ ] **Step 7: Commit**

```bash
git add src/hooks/use-receipt-scan.ts src/components/bills/ocr-activity-bar.tsx src/styles.css src/routes/bills/$billId/index.tsx
git commit -m "feat: add fixed OCR activity bar on bill edit page"
```

---

### Task 7: Final preflight

**Files:** none (verification only)

- [ ] **Step 1: Run full preflight**

Run: `pnpm run preflight`
Expected: all unit tests PASS, PWA icon check PASS, production build PASS

- [ ] **Step 2: Commit plan doc (if not already committed)**

```bash
git add docs/superpowers/plans/2026-07-15-smart-defaults.md
git commit -m "docs: add smart defaults implementation plan"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Tip 10/15/20% chips from items subtotal | Task 2, 3 |
| Remember last tip preference | Task 1, 3 |
| Custom EUR input + override | Task 3 |
| % recalc on item change | Task 3 (`useEffect` on `selectedPercent`) |
| Empty bill chips disabled + helper | Task 3 |
| Pin last-used friend group first | Task 4, 5 |
| Write on add-all + partial add | Task 5 |
| No auto-add, no Convex change | Global constraints |
| `isOcrBusy` derived flag | Task 6 |
| Fixed top indeterminate bar | Task 6 |
| Gallery + camera paths | Task 6 (`isUploading \|\| isScanning`) |
| Bill edit page only | Task 6 mount point |
| Form editable during OCR | Task 6 (only scan/upload disabled) |
