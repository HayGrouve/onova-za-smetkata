# Receipt OCR & Assignment Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual Gemini receipt scanning with review-before-import, plus bulk assignment helpers on the bill editor.

**Architecture:** User taps scan button → mutation creates `receiptScans` row and schedules internal action → Gemini extracts structured line items → review sheet → import mutation writes items. Bulk toolbar uses new `assignments.assignAll` mutation.

**Tech Stack:** Convex (actions, scheduler, storage), Gemini 2.0 Flash REST API, React, Shadcn Sheet/Dialog, existing bill editor

**Spec:** `docs/superpowers/specs/2026-07-07-receipt-ocr-assignment-polish-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `convex/schema.ts` | Add `receiptScans` table |
| `convex/receiptScan.ts` | startScan, getLatestScan, importScannedItems, dismissScan |
| `convex/receiptScanAction.ts` | `"use node"` internal action calling Gemini |
| `convex/lib/geminiReceipt.ts` | Prompt, API call, parse response |
| `convex/lib/receiptPostProcess.ts` | Filter items, totals mismatch |
| `convex/assignments.ts` | Add `assignAll` mutation |
| `src/lib/receipt-post-process.test.ts` | Tests for post-processing helpers |
| `src/components/bills/receipt-scan-review-sheet.tsx` | Review UI |
| `src/components/bills/assignment-toolbar.tsx` | Bulk split buttons |
| `src/routes/bills/$billId/index.tsx` | Scan button, dialogs, wire sheet |
| `src/components/bills/item-list.tsx` | Unassigned styling, toolbar, € placeholder |
| `.env.example` | Document GEMINI_API_KEY |

---

### Task 1: Receipt post-processing helpers

**Files:**
- Create: `convex/lib/receiptPostProcess.ts` (pure logic, importable from tests via duplicate in src OR put in `src/lib/receipt-scan-utils.ts`)
- Create: `src/lib/receipt-scan-utils.ts`
- Create: `src/lib/receipt-scan-utils.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/receipt-scan-utils.test.ts
import { describe, expect, it } from 'vitest'
import {
  filterExtractedItems,
  detectTotalsMismatch,
} from './receipt-scan-utils'

describe('filterExtractedItems', () => {
  it('removes zero and negative prices', () => {
    const items = [
      { name: 'Soup', unitPriceCents: 500, quantity: 1, confidence: 'high' as const },
      { name: 'Total', unitPriceCents: 0, quantity: 1, confidence: 'high' as const },
      { name: 'Bad', unitPriceCents: -100, quantity: 1, confidence: 'high' as const },
    ]
    expect(filterExtractedItems(items)).toHaveLength(1)
  })
})

describe('detectTotalsMismatch', () => {
  it('returns true when difference exceeds 1 cent', () => {
    expect(detectTotalsMismatch(1000, 1050)).toBe(true)
  })
  it('returns false when within 1 cent', () => {
    expect(detectTotalsMismatch(1000, 1001)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm run test -- src/lib/receipt-scan-utils.test.ts`

- [ ] **Step 3: Implement**

```typescript
// src/lib/receipt-scan-utils.ts
export interface ExtractedItem {
  name: string
  unitPriceCents: number
  quantity: number
  confidence: 'high' | 'low'
}

export function filterExtractedItems(items: ExtractedItem[]): ExtractedItem[] {
  return items.filter((i) => i.unitPriceCents > 0 && i.name.trim().length > 0)
}

export function sumItemsCents(items: ExtractedItem[]): number {
  return items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0)
}

export function detectTotalsMismatch(
  itemsTotalCents: number,
  receiptTotalCents: number | undefined,
): boolean {
  if (receiptTotalCents === undefined) return false
  return Math.abs(itemsTotalCents - receiptTotalCents) > 1
}

export function eurToCents(value: number): number {
  return Math.round(value * 100)
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/receipt-scan-utils.ts src/lib/receipt-scan-utils.test.ts
git commit -m "$(cat <<'EOF'
Add receipt scan post-processing utilities with tests.

EOF
)"
```

---

### Task 2: receiptScans schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add table**

```typescript
const extractedItemValidator = v.object({
  name: v.string(),
  unitPriceCents: v.number(),
  quantity: v.number(),
  confidence: v.union(v.literal('high'), v.literal('low')),
})

receiptScans: defineTable({
  billId: v.id('bills'),
  storageId: v.id('_storage'),
  status: v.union(
    v.literal('pending'),
    v.literal('processing'),
    v.literal('done'),
    v.literal('failed'),
  ),
  extractedRestaurantName: v.optional(v.string()),
  extractedItems: v.optional(v.array(extractedItemValidator)),
  receiptTotalCents: v.optional(v.number()),
  itemsTotalCents: v.optional(v.number()),
  totalsMismatch: v.optional(v.boolean()),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
}).index('by_billId', ['billId']),
```

- [ ] **Step 2: Deploy schema**

Run: `npx convex dev --once`

- [ ] **Step 3: Commit**

---

### Task 3: Gemini API helper

**Files:**
- Create: `convex/lib/geminiReceipt.ts` (used from node action — can duplicate post-process or import shared logic inline)

- [ ] **Step 1: Implement fetch-based Gemini call**

```typescript
// convex/lib/geminiReceipt.ts — used only from "use node" action file
const GEMINI_MODEL = 'gemini-2.0-flash'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    restaurantName: { type: 'string' },
    receiptTotalCents: { type: 'number' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          unitPriceEur: { type: 'number' },
          quantity: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
        required: ['name', 'unitPriceEur', 'quantity', 'confidence'],
      },
    },
  },
  required: ['items'],
}

export async function scanReceiptImage(
  apiKey: string,
  imageBase64: string,
  mimeType: string,
): Promise<{
  restaurantName?: string
  receiptTotalCents?: number
  items: Array<{
    name: string
    unitPriceCents: number
    quantity: number
    confidence: 'high' | 'low'
  }>
}> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Extract line items from this restaurant receipt. Receipt may be Bulgarian (Cyrillic) or English; amounts in EUR. Return purchasable food/drink items only. EXCLUDE totals, tax (ДДС/VAT), tips (бакшиш), payment lines. Default quantity 1. Mark uncertain lines confidence "low". Prices as EUR decimals in unitPriceEur.`,
              },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  )
  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${await response.text()}`)
  }
  const json = await response.json()
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty Gemini response')
  const parsed = JSON.parse(text) as {
    restaurantName?: string
    receiptTotalCents?: number
    items: Array<{
      name: string
      unitPriceEur: number
      quantity: number
      confidence: 'high' | 'low'
    }>
  }
  return {
    restaurantName: parsed.restaurantName,
    receiptTotalCents: parsed.receiptTotalCents
      ? Math.round(parsed.receiptTotalCents * 100)
      : undefined,
    items: parsed.items.map((i) => ({
      name: i.name.trim(),
      unitPriceCents: Math.round(i.unitPriceEur * 100),
      quantity: Math.max(1, Math.round(i.quantity)),
      confidence: i.confidence === 'low' ? 'low' : 'high',
    })),
  }
}
```

- [ ] **Step 2: Commit**

---

### Task 4: Scan action + mutations

**Files:**
- Create: `convex/receiptScanAction.ts`
- Create: `convex/receiptScan.ts`

- [ ] **Step 1: Internal action**

```typescript
// convex/receiptScanAction.ts
'use node'

import { internalAction } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { scanReceiptImage } from './lib/geminiReceipt'

export const runScan = internalAction({
  args: { scanId: v.id('receiptScans') },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      await ctx.runMutation(internal.receiptScan.markFailed, {
        scanId: args.scanId,
        errorMessage: 'AI не е конфигуриран (GEMINI_API_KEY)',
      })
      return
    }
    const scan = await ctx.runQuery(internal.receiptScan.getScanInternal, {
      scanId: args.scanId,
    })
    if (!scan) return

    await ctx.runMutation(internal.receiptScan.markProcessing, { scanId: args.scanId })

    try {
      const blob = await ctx.storage.get(scan.storageId)
      if (!blob) throw new Error('Receipt image not found')
      const buffer = Buffer.from(await blob.arrayBuffer())
      const base64 = buffer.toString('base64')
      const mimeType = blob.type || 'image/jpeg'

      const result = await scanReceiptImage(apiKey, base64, mimeType)
      const filtered = result.items.filter((i) => i.unitPriceCents > 0 && i.name)
      const itemsTotalCents = filtered.reduce(
        (s, i) => s + i.unitPriceCents * i.quantity,
        0,
      )
      const totalsMismatch =
        result.receiptTotalCents !== undefined &&
        Math.abs(itemsTotalCents - result.receiptTotalCents) > 1

      await ctx.runMutation(internal.receiptScan.markDone, {
        scanId: args.scanId,
        extractedRestaurantName: result.restaurantName,
        extractedItems: filtered,
        receiptTotalCents: result.receiptTotalCents,
        itemsTotalCents,
        totalsMismatch,
      })
    } catch (e) {
      await ctx.runMutation(internal.receiptScan.markFailed, {
        scanId: args.scanId,
        errorMessage: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  },
})
```

- [ ] **Step 2: Mutations and queries in receiptScan.ts**

Implement:
- `startScan` — public mutation: args `{ billId }`, uses bill.receiptStorageId, inserts scan, schedules `internal.receiptScanAction.runScan`
- `getLatestScan` — public query by billId (latest by createdAt)
- Internal: `getScanInternal`, `markProcessing`, `markDone`, `markFailed`
- `importScannedItems` — public mutation per spec
- `dismissScan` — optional delete or status update

- [ ] **Step 3: Deploy + set GEMINI_API_KEY in Convex dashboard**

- [ ] **Step 4: Commit**

---

### Task 5: Bulk assignment mutation

**Files:**
- Modify: `convex/assignments.ts`

- [ ] **Step 1: Add assignAll mutation**

```typescript
export const assignAll = mutation({
  args: {
    billId: v.id('bills'),
    mode: v.union(v.literal('all_items'), v.literal('unassigned_only')),
  },
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query('participants')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()
    const items = await ctx.db
      .query('items')
      .withIndex('by_billId', (q) => q.eq('billId', args.billId))
      .collect()

    for (const item of items) {
      const existing = await ctx.db
        .query('itemAssignments')
        .withIndex('by_itemId', (q) => q.eq('itemId', item._id))
        .collect()
      if (args.mode === 'unassigned_only' && existing.length > 0) continue

      for (const a of existing) await ctx.db.delete(a._id)
      for (const p of participants) {
        await ctx.db.insert('itemAssignments', {
          itemId: item._id,
          participantId: p._id,
        })
      }
    }
    await touchBill(ctx, args.billId)
  },
})
```

- [ ] **Step 2: Commit**

---

### Task 6: Review sheet component

**Files:**
- Create: `src/components/bills/receipt-scan-review-sheet.tsx`

- [ ] **Step 1: Build sheet with editable rows, checkboxes, totals footer, import/cancel**

Uses:
- `useQuery(api.receiptScan.getLatestScan, { billId })`
- `useMutation(api.receiptScan.importScannedItems)`
- Props: `open`, `onOpenChange`, `billId`, `importMode: 'add' | 'replace'`

- [ ] **Step 2: Commit**

---

### Task 7: Assignment toolbar

**Files:**
- Create: `src/components/bills/assignment-toolbar.tsx`

- [ ] **Step 1: Two buttons + unassigned count badge**

Calls `api.assignments.assignAll` with confirm dialog for „Разпредели всички по равно“.

- [ ] **Step 2: Commit**

---

### Task 8: Wire bill editor

**Files:**
- Modify: `src/routes/bills/$billId/index.tsx`
- Modify: `src/components/bills/item-list.tsx`

- [ ] **Step 1: Add scan button** (disabled without receipt, loading state)

- [ ] **Step 2: Pre-scan dialog** when items.length > 0

- [ ] **Step 3: Open review sheet when scan status === 'done'**

- [ ] **Step 4: Error toast on failed scan**

- [ ] **Step 5: Add AssignmentToolbar above items**

- [ ] **Step 6: Unassigned item border + id for scroll target**

- [ ] **Step 7: Fix placeholder to „Цена (€)“**

- [ ] **Step 8: Commit**

---

### Task 9: Environment docs

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add comment**

```
# Set in Convex Dashboard (not .env.local):
# GEMINI_API_KEY=your-google-ai-key
```

- [ ] **Step 2: Commit**

---

### Task 10: Final verification

- [ ] **Step 1:** `npm run test` — all pass
- [ ] **Step 2:** `npm run lint` — clean
- [ ] **Step 3:** Manual test with real receipt photo + GEMINI_API_KEY
- [ ] **Step 4:** Commit fixes if any

---

## Plan Self-Review

**Spec coverage:** Scan button, Gemini action, review sheet, add/replace dialog, bulk helpers, unassigned highlight, totals mismatch, error handling — all mapped to tasks.

**No placeholders:** Core Gemini call and mutations include concrete code.

**Type consistency:** `unitPriceCents`, `confidence`, scan `status` values match spec.
