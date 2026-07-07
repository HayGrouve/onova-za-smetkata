# Personal Bill Splitter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile web PWA bill splitter with Convex backend — create bills, assign items, calculate splits, track payments, browse history.

**Architecture:** TanStack Start UI with direct Convex queries/mutations. Pure calculation logic in testable TS modules. Amounts stored as EUR cents. Bulgarian UI. Auto-save drafts via debounced mutations.

**Tech Stack:** TanStack Start, TanStack Router, React 19, Convex, Shadcn UI, Tailwind CSS v4, Vitest

**Spec:** `docs/superpowers/specs/2026-07-07-personal-bill-splitter-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `convex/schema.ts` | Table definitions and indexes |
| `convex/bills.ts` | Bill CRUD, list, finalize, delete cascade |
| `convex/participants.ts` | Participant add/remove/reorder |
| `convex/items.ts` | Item CRUD |
| `convex/assignments.ts` | Toggle assignment per item+participant |
| `convex/payments.ts` | Record full/partial payments |
| `convex/files.ts` | Receipt upload URL generation |
| `src/lib/bill-calculations.ts` | Pure split/total logic |
| `src/lib/format-currency.ts` | EUR formatting for bg-BG locale |
| `src/hooks/use-debounced-callback.ts` | Debounce helper for auto-save |
| `src/components/bills/` | Bill UI components |
| `src/routes/index.tsx` | Home — list, search, new bill |
| `src/routes/bills/$billId.tsx` | Bill editor |
| `src/routes/bills/$billId/summary.tsx` | Summary, finalize, payments |
| `public/manifest.json` | PWA config |

---

### Task 1: Bill calculation module

**Files:**
- Create: `src/lib/bill-calculations.ts`
- Create: `src/lib/bill-calculations.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/bill-calculations.test.ts
import { describe, expect, it } from 'vitest'
import {
  splitLineTotal,
  calculateBillTotals,
  type BillCalculationInput,
} from './bill-calculations'

describe('splitLineTotal', () => {
  it('assigns full amount to one person', () => {
    expect(splitLineTotal(1000, ['a'])).toEqual([{ id: 'a', cents: 1000 }])
  })

  it('splits evenly with remainder to first participants', () => {
    const result = splitLineTotal(100, ['a', 'b', 'c'])
    expect(result).toEqual([
      { id: 'a', cents: 34 },
      { id: 'b', cents: 33 },
      { id: 'c', cents: 33 },
    ])
  })
})

describe('calculateBillTotals', () => {
  it('computes owed, paid, and balance per participant', () => {
    const input: BillCalculationInput = {
      participants: [
        { id: 'p1', sortOrder: 0 },
        { id: 'p2', sortOrder: 1 },
      ],
      items: [
        { id: 'i1', unitPriceCents: 1000, quantity: 1 },
        { id: 'i2', unitPriceCents: 2000, quantity: 1 },
      ],
      assignments: [
        { itemId: 'i1', participantId: 'p1' },
        { itemId: 'i2', participantId: 'p2' },
      ],
      payments: [{ participantId: 'p1', amountCents: 1000 }],
    }
    const totals = calculateBillTotals(input)
    expect(totals.billTotalCents).toBe(3000)
    expect(totals.byParticipant.p1).toMatchObject({
      owedCents: 1000,
      paidCents: 1000,
      balanceCents: 0,
      status: 'paid',
    })
    expect(totals.byParticipant.p2).toMatchObject({
      owedCents: 2000,
      paidCents: 0,
      balanceCents: 2000,
      status: 'unpaid',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/bill-calculations.test.ts`  
Expected: FAIL — module not found

- [ ] **Step 3: Implement calculation module**

```typescript
// src/lib/bill-calculations.ts
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'

export interface ParticipantInput {
  id: string
  sortOrder: number
}

export interface ItemInput {
  id: string
  unitPriceCents: number
  quantity: number
}

export interface AssignmentInput {
  itemId: string
  participantId: string
}

export interface PaymentInput {
  participantId: string
  amountCents: number
}

export interface BillCalculationInput {
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
  payments: PaymentInput[]
}

export interface ParticipantTotals {
  owedCents: number
  paidCents: number
  balanceCents: number
  status: PaymentStatus
}

export interface BillTotals {
  billTotalCents: number
  byParticipant: Record<string, ParticipantTotals>
}

export function lineTotalCents(item: ItemInput): number {
  return item.unitPriceCents * item.quantity
}

export function splitLineTotal(
  totalCents: number,
  participantIds: string[],
): Array<{ id: string; cents: number }> {
  if (participantIds.length === 0) return []
  const base = Math.floor(totalCents / participantIds.length)
  const remainder = totalCents % participantIds.length
  return participantIds.map((id, index) => ({
    id,
    cents: base + (index < remainder ? 1 : 0),
  }))
}

function paymentStatus(owedCents: number, paidCents: number): PaymentStatus {
  if (paidCents <= 0) return 'unpaid'
  if (paidCents >= owedCents) return 'paid'
  return 'partial'
}

export function calculateBillTotals(input: BillCalculationInput): BillTotals {
  const owedByParticipant: Record<string, number> = {}
  for (const p of input.participants) {
    owedByParticipant[p.id] = 0
  }

  let billTotalCents = 0

  for (const item of input.items) {
    const total = lineTotalCents(item)
    billTotalCents += total

    const assignedIds = input.assignments
      .filter((a) => a.itemId === item.id)
      .map((a) => a.participantId)

    const sortedIds = [...assignedIds].sort((a, b) => {
      const orderA =
        input.participants.find((p) => p.id === a)?.sortOrder ?? 0
      const orderB =
        input.participants.find((p) => p.id === b)?.sortOrder ?? 0
      return orderA - orderB
    })

    for (const portion of splitLineTotal(total, sortedIds)) {
      owedByParticipant[portion.id] =
        (owedByParticipant[portion.id] ?? 0) + portion.cents
    }
  }

  const paidByParticipant: Record<string, number> = {}
  for (const p of input.participants) {
    paidByParticipant[p.id] = 0
  }
  for (const payment of input.payments) {
    paidByParticipant[payment.participantId] =
      (paidByParticipant[payment.participantId] ?? 0) + payment.amountCents
  }

  const byParticipant: Record<string, ParticipantTotals> = {}
  for (const p of input.participants) {
    const owedCents = owedByParticipant[p.id] ?? 0
    const paidCents = paidByParticipant[p.id] ?? 0
    const balanceCents = owedCents - paidCents
    byParticipant[p.id] = {
      owedCents,
      paidCents,
      balanceCents,
      status: paymentStatus(owedCents, paidCents),
    }
  }

  return { billTotalCents, byParticipant }
}

export interface ValidationError {
  code: 'no_participants' | 'no_items' | 'unassigned_items'
  message: string
}

export function validateBillForFinalize(input: {
  participants: ParticipantInput[]
  items: ItemInput[]
  assignments: AssignmentInput[]
}): ValidationError[] {
  const errors: ValidationError[] = []

  if (input.participants.length === 0) {
    errors.push({
      code: 'no_participants',
      message: 'Добавете поне един участник.',
    })
  }

  const pricedItems = input.items.filter((i) => lineTotalCents(i) > 0)
  if (pricedItems.length === 0) {
    errors.push({
      code: 'no_items',
      message: 'Добавете поне един артикул с цена.',
    })
  }

  const unassigned = pricedItems.filter(
    (item) =>
      !input.assignments.some((a) => a.itemId === item.id),
  )
  if (unassigned.length > 0) {
    errors.push({
      code: 'unassigned_items',
      message: 'Всички артикули трябва да имат поне един участник.',
    })
  }

  return errors
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- src/lib/bill-calculations.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/bill-calculations.ts src/lib/bill-calculations.test.ts
git commit -m "$(cat <<'EOF'
Add pure bill split calculation module with tests.

EOF
)"
```

---

### Task 2: Currency formatting

**Files:**
- Create: `src/lib/format-currency.ts`
- Create: `src/lib/format-currency.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/lib/format-currency.test.ts
import { describe, expect, it } from 'vitest'
import { formatEur, parseEurInput } from './format-currency'

describe('formatEur', () => {
  it('formats cents as EUR in bg-BG locale', () => {
    expect(formatEur(1250)).toMatch(/12[,.]50/)
  })
})

describe('parseEurInput', () => {
  it('parses comma decimal input', () => {
    expect(parseEurInput('12,50')).toBe(1250)
  })

  it('parses dot decimal input', () => {
    expect(parseEurInput('12.50')).toBe(1250)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm run test -- src/lib/format-currency.test.ts`

- [ ] **Step 3: Implement**

```typescript
// src/lib/format-currency.ts
const eurFormatter = new Intl.NumberFormat('bg-BG', {
  style: 'currency',
  currency: 'EUR',
})

export function formatEur(cents: number): string {
  return eurFormatter.format(cents / 100)
}

export function parseEurInput(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  if (Number.isNaN(parsed)) return 0
  return Math.round(parsed * 100)
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

---

### Task 3: Convex schema

**Files:**
- Modify: `convex/schema.ts` (replace demo tables)

- [ ] **Step 1: Replace schema**

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  bills: defineTable({
    restaurantName: v.string(),
    date: v.number(),
    note: v.optional(v.string()),
    receiptStorageId: v.optional(v.id('_storage')),
    status: v.union(v.literal('draft'), v.literal('final')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_status', ['status'])
    .index('by_updatedAt', ['updatedAt']),

  participants: defineTable({
    billId: v.id('bills'),
    name: v.string(),
    sortOrder: v.number(),
  }).index('by_billId', ['billId']),

  items: defineTable({
    billId: v.id('bills'),
    name: v.string(),
    unitPriceCents: v.number(),
    quantity: v.number(),
    note: v.optional(v.string()),
    sortOrder: v.number(),
  }).index('by_billId', ['billId']),

  itemAssignments: defineTable({
    itemId: v.id('items'),
    participantId: v.id('participants'),
  })
    .index('by_itemId', ['itemId'])
    .index('by_participantId', ['participantId']),

  payments: defineTable({
    billId: v.id('bills'),
    participantId: v.id('participants'),
    amountCents: v.number(),
    note: v.optional(v.string()),
    paidAt: v.number(),
  }).index('by_billId', ['billId']),
})
```

- [ ] **Step 2: Delete demo files**

Delete: `convex/todos.ts`

- [ ] **Step 3: Push schema**

Run: `npx convex dev --once` (with Convex running)  
Expected: Schema deploys without errors

- [ ] **Step 4: Commit**

---

### Task 4: Convex bills API

**Files:**
- Create: `convex/bills.ts`

- [ ] **Step 1: Implement bills queries and mutations**

```typescript
// convex/bills.ts
import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('bills')
      .withIndex('by_updatedAt')
      .order('desc')
      .collect()
  },
})

export const get = query({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const bill = await ctx.db.get(args.billId)
    if (!bill) return null

    const participants = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    const items = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    const assignments = (
      await Promise.all(
        items.map((item) =>
          ctx.db
            .query('itemAssignments')
            .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
            .collect(),
        ),
      )
    ).flat()

    const payments = await ctx.db
      .query('payments')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    return { bill, participants, items, assignments, payments }
  },
})

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    return await ctx.db.insert('bills', {
      restaurantName: '',
      date: now,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    billId: v.id('bills'),
    restaurantName: v.optional(v.string()),
    date: v.optional(v.number()),
    note: v.optional(v.string()),
    receiptStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const { billId, ...fields } = args
    const patch: Record<string, unknown> = { updatedAt: Date.now() }
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) patch[key] = value
    }
    await ctx.db.patch(billId, patch)
  },
})

export const finalize = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.billId, {
      status: 'final',
      updatedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { billId: v.id('bills') },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const items = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const payments = await ctx.db
      .query('payments')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    for (const item of items) {
      const assignments = await ctx.db
        .query('itemAssignments')
        .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
        .collect()
      for (const a of assignments) await ctx.db.delete(a._id)
      await ctx.db.delete(item._id)
    }
    for (const p of participants) await ctx.db.delete(p._id)
    for (const pay of payments) await ctx.db.delete(pay._id)
    await ctx.db.delete(args.billId)
  },
})
```

- [ ] **Step 2: Deploy and verify in Convex dashboard**

- [ ] **Step 3: Commit**

---

### Task 5: Convex participants, items, assignments, payments

**Files:**
- Create: `convex/participants.ts`
- Create: `convex/items.ts`
- Create: `convex/assignments.ts`
- Create: `convex/payments.ts`

- [ ] **Step 1: participants.ts**

```typescript
import { mutation } from './_generated/server'
import { v } from 'convex/values'

async function touchBill(ctx: { db: any }, billId: any) {
  await ctx.db.patch(billId, { updatedAt: Date.now() })
}

export const add = mutation({
  args: { billId: v.id('bills'), name: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const id = await ctx.db.insert('participants', {
      billId: args.billId,
      name: args.name.trim(),
      sortOrder: existing.length,
    })
    await touchBill(ctx, args.billId)
    return id
  },
})

export const remove = mutation({
  args: { participantId: v.id('participants') },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId)
    if (!participant) return

    const assignments = await ctx.db
      .query('itemAssignments')
      .withIndex('by_participantId', (q) =>
        q.eq('participantId', args.participantId),
      )
      .collect()
    for (const a of assignments) await ctx.db.delete(a._id)

    const payments = await ctx.db
      .query('payments')
      .withIndex('by_billId', (q) => q.eq('billId', participant.billId))
      .collect()
    for (const p of payments.filter(
      (pay) => pay.participantId === args.participantId,
    )) {
      await ctx.db.delete(p._id)
    }

    await ctx.db.delete(args.participantId)
    await touchBill(ctx, participant.billId)
  },
})
```

- [ ] **Step 2: items.ts** — `add`, `update`, `remove` mutations with `touchBill`

- [ ] **Step 3: assignments.ts** — `toggle` mutation: if exists delete, else insert

- [ ] **Step 4: payments.ts** — `add` mutation with `billId`, `participantId`, `amountCents`, optional `note`, `paidAt: Date.now()`

- [ ] **Step 5: Commit**

---

### Task 6: Receipt file upload

**Files:**
- Create: `convex/files.ts`

- [ ] **Step 1: Implement generateUploadUrl mutation**

```typescript
import { mutation } from './_generated/server'

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl()
  },
})
```

- [ ] **Step 2: Commit**

---

### Task 7: Install Shadcn components

- [ ] **Step 1: Install components**

```bash
pnpm dlx shadcn@latest add button input label card badge dialog sheet toast separator
```

- [ ] **Step 2: Commit**

---

### Task 8: App shell and PWA

**Files:**
- Modify: `src/routes/__root.tsx`
- Modify: `public/manifest.json`

- [ ] **Step 1: Update root layout**

Set `lang="bg"`, title „Онова за сметката“, add manifest link in head, `theme-color` meta.

- [ ] **Step 2: Update manifest.json**

```json
{
  "short_name": "Сметка",
  "name": "Онова за сметката",
  "display": "standalone",
  "start_url": "/",
  "theme_color": "#0f172a",
  "background_color": "#ffffff"
}
```

- [ ] **Step 3: Fix Convex provider env check**

In `src/integrations/convex/provider.tsx`, change `CONVEX_URL` to `VITE_CONVEX_URL`.

- [ ] **Step 4: Commit**

---

### Task 9: Home screen

**Files:**
- Modify: `src/routes/index.tsx`
- Create: `src/components/bills/bill-card.tsx`

- [ ] **Step 1: Implement home with useQuery(api.bills.list)**

- „Нова сметка“ calls `useMutation(api.bills.create)` then navigates to `/bills/$billId`

- Search input filters client-side by `restaurantName` and participant names (requires loading participant data per bill or a lightweight list query — extend `bills.list` to join participant names)

- [ ] **Step 2: BillCard shows restaurant, date, total, draft badge, outstanding balance**

- [ ] **Step 3: Tap navigates to editor (draft) or summary (final)**

- [ ] **Step 4: Commit**

---

### Task 10: Bill editor page

**Files:**
- Create: `src/routes/bills/$billId.tsx`
- Create: `src/components/bills/participant-list.tsx`
- Create: `src/components/bills/item-list.tsx`
- Create: `src/components/bills/assignment-row.tsx`
- Create: `src/hooks/use-debounced-callback.ts`

- [ ] **Step 1: Load bill via useQuery(api.bills.get)**

- [ ] **Step 2: Header section** — restaurant, date, note fields with debounced `bills.update`

- [ ] **Step 3: Participant section** — add/remove with mutations

- [ ] **Step 4: Item section** — add/edit/delete items

- [ ] **Step 5: Assignment section** — chip toggles calling `assignments.toggle`

- [ ] **Step 6: Receipt photo** — file input → `files.generateUploadUrl` → POST file → `bills.update` with storageId

- [ ] **Step 7: „Преглед“ button** navigates to summary

- [ ] **Step 8: Commit**

---

### Task 11: Sticky totals bar

**Files:**
- Create: `src/components/bills/sticky-totals-bar.tsx`

- [ ] **Step 1: Compute totals client-side with calculateBillTotals from loaded bill data**

- [ ] **Step 2: Fixed bottom bar showing each participant name + owed amount**

- [ ] **Step 3: Expandable sheet with full breakdown on tap**

- [ ] **Step 4: Commit**

---

### Task 12: Summary and payments page

**Files:**
- Create: `src/routes/bills/$billId/summary.tsx`
- Create: `src/components/bills/payment-row.tsx`
- Create: `src/components/bills/participant-label.tsx` (handles duplicate name disambiguation)

- [ ] **Step 1: Display bill totals using calculateBillTotals**

- [ ] **Step 2: Show validation errors from validateBillForFinalize**

- [ ] **Step 3: „Завърши сметка“ button** — disabled if errors; calls `bills.finalize`

- [ ] **Step 4: Payment rows** — „Платено“ records full balance; partial via input + `payments.add`

- [ ] **Step 5: „Редактирай“ navigates back to editor**

- [ ] **Step 6: „Изтрий“ with confirmation dialog** calls `bills.remove`

- [ ] **Step 7: Commit**

---

### Task 13: Duplicate name disambiguation

**Files:**
- Create: `src/lib/participant-labels.ts`
- Create: `src/lib/participant-labels.test.ts`

- [ ] **Step 1: Test and implement getParticipantLabel(names, index) → „Иван" or „Иван (2)"**

- [ ] **Step 2: Use in sticky bar, summary, assignment chips**

- [ ] **Step 3: Commit**

---

### Task 14: Delete undo toast

**Files:**
- Modify: item/participant delete handlers in editor components

- [ ] **Step 1: On delete, store deleted entity snapshot in component state**

- [ ] **Step 2: Show toast „Артикулът е изтрит“ with „Отмени" for 5 seconds**

- [ ] **Step 3: Undo re-inserts via add mutation (note: new ID — acceptable for MVP)**

- [ ] **Step 4: Commit**

---

### Task 15: Final verification

- [ ] **Step 1: Run all tests**

Run: `npm run test`  
Expected: All pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`

- [ ] **Step 3: Manual smoke test**

1. Create bill → add 2 people → add items → assign → verify sticky totals
2. Finalize → mark one paid → verify balance
3. Search on home by restaurant name
4. Delete bill

- [ ] **Step 4: Commit any fixes**

---

## Plan Self-Review

**Spec coverage:** All acceptance criteria map to Tasks 1–15. Draft auto-save covered in Task 10 debounced updates. PWA in Task 8. Search in Task 9.

**No placeholders:** All core code provided inline; Tasks 5 Step 2–4 follow patterns shown in Step 1.

**Type consistency:** `unitPriceCents`, `amountCents`, `status: 'draft' | 'final'` used consistently across schema, Convex, and calculation module.
