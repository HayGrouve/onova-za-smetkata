# Solo Operator Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Help a single bill operator share totals, copy/Revolut-pay amounts, track payment progress, quick-add recent participants, and enforce restaurant name before finalize.

**Architecture:** Pure TS helpers for share/copy text; localStorage for Revolut/IBAN settings; one new Convex query for recent names; server guard on finalize; summary/editor UI components.

**Tech Stack:** Convex, React, TanStack Router, Shadcn, Vitest, Web Share API, localStorage

**Spec:** `docs/superpowers/specs/2026-07-07-solo-operator-pack-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/lib/bill-share.ts` | Share text + copy amount formatters |
| `src/lib/bill-share.test.ts` | Tests |
| `src/lib/payment-settings.ts` | localStorage CRUD |
| `src/lib/bill-calculations.ts` | `missing_restaurant` validation |
| `src/lib/bill-calculations.test.ts` | Validation test |
| `convex/participants.ts` | `listRecentNames` query |
| `convex/bills.ts` | Server finalize guard |
| `src/components/bills/payment-settings-sheet.tsx` | Settings UI |
| `src/components/bills/share-bill-button.tsx` | Share/copy button |
| `src/components/bills/payment-progress.tsx` | Progress bar |
| `src/components/bills/participant-pay-actions.tsx` | Copy/Revolut/IBAN |
| `src/components/bills/payment-row.tsx` | Wire pay actions + tap copy |
| `src/components/bills/participant-detail-sheet.tsx` | Wire pay actions |
| `src/components/bills/participant-list.tsx` | Recent name chips |
| `src/components/bills/bill-card.tsx` | Delete dropdown |
| `src/routes/bills/$billId/summary.tsx` | Integrate all summary features |
| `src/routes/index.tsx` | Settings button |
| `src/routes/__root.tsx` | DEV-only devtools |

---

### Task 1: Share text and copy helpers

**Files:**
- Create: `src/lib/bill-share.ts`
- Create: `src/lib/bill-share.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import { formatBillShareText, formatCopyAmount } from './bill-share'

describe('formatCopyAmount', () => {
  it('formats cents as decimal comma without symbol', () => {
    expect(formatCopyAmount(1250)).toBe('12,50')
    expect(formatCopyAmount(0)).toBe('0,00')
  })
})

describe('formatBillShareText', () => {
  it('builds bulgarian summary with statuses', () => {
    const text = formatBillShareText({
      restaurantName: 'Механа',
      date: new Date('2026-07-07T12:00:00'),
      billTotalCents: 3000,
      participants: [
        { label: 'Иван', owedCents: 1500, status: 'unpaid' as const },
        { label: 'Мария', owedCents: 1500, status: 'paid' as const },
      ],
    })
    expect(text).toContain('Механа')
    expect(text).toContain('Иван')
    expect(text).toContain('неплатено')
    expect(text).toContain('платено')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- --run src/lib/bill-share.test.ts`

- [ ] **Step 3: Implement `bill-share.ts`**

```typescript
import type { PaymentStatus } from './bill-calculations.ts'

const statusLabels: Record<PaymentStatus, string> = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
}

const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatCopyAmount(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function formatRevolutAmount(cents: number): string {
  return (cents / 100).toFixed(2)
}

export interface ShareParticipantLine {
  label: string
  owedCents: number
  status: PaymentStatus
}

export interface BillShareInput {
  restaurantName: string
  date: Date
  billTotalCents: number
  participants: ShareParticipantLine[]
}

export function formatBillShareText(input: BillShareInput): string {
  const title = input.restaurantName.trim() || 'Без име'
  const header = `Сметка: ${title}, ${dateFormatter.format(input.date)}`
  const total = `Общо: ${formatCopyAmount(input.billTotalCents)} EUR`
  const lines = input.participants.map(
    (p) =>
      `${p.label}: ${formatCopyAmount(p.owedCents)} EUR — ${statusLabels[p.status]}`,
  )
  return [header, total, '', ...lines].join('\n')
}

export async function shareOrCopyText(text: string, title: string): Promise<'shared' | 'copied'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text })
      return 'shared'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error
      }
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/bill-share.ts src/lib/bill-share.test.ts
git commit -m "$(cat <<'EOF'
Add bill share text and copy amount formatters.

EOF
)"
```

---

### Task 2: Payment settings (localStorage)

**Files:**
- Create: `src/lib/payment-settings.ts`
- Create: `src/components/bills/payment-settings-sheet.tsx`

- [ ] **Step 1: Create `payment-settings.ts`**

```typescript
const STORAGE_KEY = 'onova-payment-settings'

export interface PaymentSettings {
  revolutUsername?: string
  iban?: string
}

export function loadPaymentSettings(): PaymentSettings {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PaymentSettings
  } catch {
    return {}
  }
}

export function savePaymentSettings(settings: PaymentSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function buildRevolutUrl(username: string, remainingCents: number): string {
  const clean = username.replace(/^@/, '').trim()
  const amount = (remainingCents / 100).toFixed(2)
  return `https://revolut.me/${encodeURIComponent(clean)}/${amount}`
}
```

- [ ] **Step 2: Create settings sheet component**

Sheet with two inputs (Revolut username, IBAN), load on open, save button calls `savePaymentSettings`. Export `PaymentSettingsSheet` with `open` / `onOpenChange` props.

- [ ] **Step 3: Add settings trigger on home (`index.tsx`)**

Button **„Настройки за плащане“** below header area opens sheet.

- [ ] **Step 4: Commit**

```bash
git add src/lib/payment-settings.ts src/components/bills/payment-settings-sheet.tsx src/routes/index.tsx
git commit -m "$(cat <<'EOF'
Add local payment settings sheet for Revolut and IBAN.

EOF
)"
```

---

### Task 3: Participant pay actions

**Files:**
- Create: `src/components/bills/participant-pay-actions.tsx`
- Modify: `src/components/bills/payment-row.tsx`
- Modify: `src/components/bills/participant-detail-sheet.tsx`

- [ ] **Step 1: Create `ParticipantPayActions`**

Props: `remainingCents`, `label`. Load settings via `loadPaymentSettings()`.

Buttons row (only when `remainingCents > 0`):
- **Копирай** → clipboard `formatCopyAmount(remainingCents)` + toast
- **Revolut** → copy amount + `window.open(buildRevolutUrl(...))` if username set
- **IBAN** → copy IBAN if set

Use `variant="outline"` `size="sm"` buttons in a flex row.

- [ ] **Step 2: Add tap-to-copy on Остатък in PaymentRow**

Make remaining balance cell a button with `onClick` copy + `ParticipantPayActions` below existing PaymentActions.

- [ ] **Step 3: Add same to ParticipantDetailSheet** totals grid

- [ ] **Step 4: Commit**

```bash
git add src/components/bills/participant-pay-actions.tsx src/components/bills/payment-row.tsx src/components/bills/participant-detail-sheet.tsx
git commit -m "$(cat <<'EOF'
Add copy, Revolut, and IBAN payment actions per participant.

EOF
)"
```

---

### Task 4: Share button and payment progress

**Files:**
- Create: `src/components/bills/share-bill-button.tsx`
- Create: `src/components/bills/payment-progress.tsx`
- Modify: `src/routes/bills/$billId/summary.tsx`

- [ ] **Step 1: Create `ShareBillButton`**

Props: bill data + totals + labels. On click: build share text, call `shareOrCopyText`, toast „Споделено“ or „Копирано“, handle AbortError silently.

- [ ] **Step 2: Create `PaymentProgress`**

Props: `participants`, `totals.byParticipant`. Compute paid count, render bar + „X от Y платени“.

- [ ] **Step 3: Wire summary page**

After total card:
```tsx
<ShareBillButton ... />
<Button variant="ghost" onClick={() => setSettingsOpen(true)}>Настройки за плащане</Button>
```

Before payments card:
```tsx
<PaymentProgress ... />
```

Sort participants: unpaid (0) → partial (1) → paid (2), then sortOrder.

Pass `restaurantName` into validation (Task 5).

- [ ] **Step 4: Commit**

```bash
git add src/components/bills/share-bill-button.tsx src/components/bills/payment-progress.tsx src/routes/bills/$billId/summary.tsx
git commit -m "$(cat <<'EOF'
Add share button and payment progress to bill summary.

EOF
)"
```

---

### Task 5: Validation and recent names

**Files:**
- Modify: `src/lib/bill-calculations.ts`
- Modify: `src/lib/bill-calculations.test.ts`
- Modify: `convex/participants.ts`
- Modify: `convex/bills.ts`
- Modify: `src/components/bills/participant-list.tsx`
- Modify: `src/routes/bills/$billId/summary.tsx`

- [ ] **Step 1: Extend validation**

Add to `validateBillForFinalize` args: `restaurantName: string`

```typescript
if (!input.restaurantName.trim()) {
  errors.push({
    code: 'missing_restaurant',
    message: 'Въведете име на ресторант.',
  })
}
```

Add test in `bill-calculations.test.ts`.

- [ ] **Step 2: Server finalize guard in `convex/bills.ts`**

```typescript
const bill = await ctx.db.get(args.billId)
if (!bill) throw new Error('Bill not found')
if (!bill.restaurantName.trim()) {
  throw new Error('Въведете име на ресторант.')
}
```

- [ ] **Step 3: Add `listRecentNames` query**

```typescript
export const listRecentNames = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const max = args.limit ?? 12
    const bills = await ctx.db
      .query('bills')
      .withIndex('by_updatedAt')
      .order('desc')
      .collect()
    const seen = new Set<string>()
    const names: string[] = []
    for (const bill of bills) {
      const participants = await ctx.db
        .query('participants')
        .withIndex('by_billId', (q) => q.eq('billId', bill._id))
        .collect()
      for (const p of participants) {
        const key = p.name.trim().toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)
        names.push(p.name.trim())
        if (names.length >= max) return names
      }
    }
    return names
  },
})
```

- [ ] **Step 4: Recent chips in ParticipantList**

Query `listRecentNames`, filter names already on bill, render chip buttons above input.

- [ ] **Step 5: Pass restaurantName to validateBillForFinalize in summary**

- [ ] **Step 6: Run tests + commit**

```bash
npm test -- --run
git add src/lib/bill-calculations.ts src/lib/bill-calculations.test.ts convex/participants.ts convex/bills.ts src/components/bills/participant-list.tsx src/routes/bills/$billId/summary.tsx
git commit -m "$(cat <<'EOF'
Require restaurant name to finalize and add recent participant quick-add.

EOF
)"
```

---

### Task 6: Home delete and devtools

**Files:**
- Modify: `src/components/bills/bill-card.tsx`
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: BillCard delete menu**

Wrap card content: keep Link for main tap, add DropdownMenu trigger (⋮) with `e.stopPropagation()` and `e.preventDefault()` on menu. Delete item calls `bills.remove` with confirm Dialog (extract or inline).

- [ ] **Step 2: Hide devtools in production**

```tsx
{import.meta.env.DEV && (
  <TanStackDevtools ... />
)}
```

- [ ] **Step 3: Run tests + manual smoke**

- [ ] **Step 4: Commit**

```bash
git add src/components/bills/bill-card.tsx src/routes/index.tsx src/routes/__root.tsx
git commit -m "$(cat <<'EOF'
Add delete bill from home and hide devtools in production.

EOF
)"
```

---

### Task 7: Final verification

- [ ] Share bill on summary (clipboard on desktop)
- [ ] Copy / Revolut / IBAN buttons with settings filled
- [ ] Progress bar updates when marking paid
- [ ] Recent name chips on editor
- [ ] Finalize blocked without restaurant name
- [ ] Delete bill from home

Run: `npm test -- --run`
