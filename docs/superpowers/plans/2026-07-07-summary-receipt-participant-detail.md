# Summary Receipt Preview & Participant Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show receipt image on summary with tap-to-expand modal, and open a participant breakdown bottom sheet (items + tip + payments) when tapping a person on the summary page.

**Architecture:** Pure client-side `calculateParticipantBreakdown()` mirrors existing split logic. New Shadcn components for receipt preview and participant sheet. Extract shared payment controls from `PaymentRow`.

**Tech Stack:** TanStack Router, React, Convex queries (existing), Shadcn Dialog/Sheet, Vitest

**Spec:** `docs/superpowers/specs/2026-07-07-summary-receipt-participant-detail-design.md`

---

## File Map

| File                                                | Responsibility                                           |
| --------------------------------------------------- | -------------------------------------------------------- |
| `src/lib/bill-calculations.ts`                      | Add breakdown types + `calculateParticipantBreakdown`    |
| `src/lib/bill-calculations.test.ts`                 | Breakdown + invariant tests                              |
| `src/components/bills/payment-actions.tsx`          | Shared mark-paid / partial payment UI                    |
| `src/components/bills/payment-row.tsx`              | Use `PaymentActions`; tap row to open sheet              |
| `src/components/bills/receipt-preview-card.tsx`     | Thumbnail + full-screen Dialog                           |
| `src/components/bills/participant-detail-sheet.tsx` | Breakdown lines + totals + payment actions               |
| `src/routes/bills/$billId/summary.tsx`              | Wire receipt card, sheet state, item names in calc input |

---

### Task 1: Participant breakdown calculation

**Files:**

- Modify: `src/lib/bill-calculations.ts`
- Modify: `src/lib/bill-calculations.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/lib/bill-calculations.test.ts`:

```typescript
import {
  calculateBillTotals,
  calculateParticipantBreakdown,
  type BillBreakdownInput,
} from './bill-calculations'

describe('calculateParticipantBreakdown', () => {
  const baseInput: BillBreakdownInput = {
    participants: [
      { id: 'p1', sortOrder: 0 },
      { id: 'p2', sortOrder: 1 },
      { id: 'p3', sortOrder: 2 },
    ],
    items: [
      { id: 'i1', name: 'Пица', unitPriceCents: 1200, quantity: 1 },
      { id: 'i2', name: 'Кола', unitPriceCents: 229, quantity: 4 },
    ],
    assignments: [
      { itemId: 'i1', participantId: 'p1' },
      { itemId: 'i1', participantId: 'p2' },
      { itemId: 'i2', participantId: 'p1', units: 2 },
      { itemId: 'i2', participantId: 'p2', units: 1 },
      { itemId: 'i2', participantId: 'p3', units: 1 },
    ],
    tipCents: 300,
  }

  it('returns item lines with correct amounts for unit and equal splits', () => {
    const p1 = calculateParticipantBreakdown(baseInput, 'p1')
    expect(p1.itemsSubtotalCents).toBe(1058)
    expect(p1.tipCents).toBe(100)
    expect(p1.owedCents).toBe(1158)
    expect(p1.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'item',
          label: 'Пица',
          amountCents: 600,
          sharedWithCount: 1,
        }),
        expect.objectContaining({
          kind: 'item',
          label: 'Кола',
          amountCents: 458,
          units: 2,
          totalUnits: 4,
        }),
        expect.objectContaining({ kind: 'tip', amountCents: 100 }),
      ]),
    )
  })

  it('matches calculateBillTotals owedCents for every participant', () => {
    const totals = calculateBillTotals({
      ...baseInput,
      payments: [],
    })
    for (const p of baseInput.participants) {
      const breakdown = calculateParticipantBreakdown(baseInput, p.id)
      expect(breakdown.owedCents).toBe(totals.byParticipant[p.id].owedCents)
      expect(
        breakdown.lines.reduce((sum, line) => sum + line.amountCents, 0),
      ).toBe(breakdown.owedCents)
    }
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- --run src/lib/bill-calculations.test.ts`  
Expected: FAIL — `calculateParticipantBreakdown` not exported

- [ ] **Step 3: Implement in `src/lib/bill-calculations.ts`**

Add types and function after existing exports:

```typescript
export interface ItemBreakdownInput extends ItemInput {
  name: string
}

export interface BillBreakdownInput {
  participants: ParticipantInput[]
  items: ItemBreakdownInput[]
  assignments: AssignmentInput[]
  tipCents?: number
}

export interface ParticipantBreakdownLine {
  kind: 'item' | 'tip'
  label: string
  amountCents: number
  sharedWithCount?: number
  units?: number
  totalUnits?: number
}

export interface ParticipantBreakdown {
  lines: ParticipantBreakdownLine[]
  itemsSubtotalCents: number
  tipCents: number
  owedCents: number
}

export function calculateParticipantBreakdown(
  input: BillBreakdownInput,
  participantId: string,
): ParticipantBreakdown {
  const lines: ParticipantBreakdownLine[] = []
  let itemsSubtotalCents = 0

  for (const item of input.items) {
    const itemAssignments = input.assignments.filter(
      (a) => a.itemId === item.id,
    )
    const usesUnits = itemAssignments.some((a) => a.units !== undefined)

    if (usesUnits) {
      const assignment = itemAssignments.find(
        (a) => a.participantId === participantId,
      )
      if (!assignment) continue
      const units = assignment.units ?? 0
      if (units <= 0) continue
      const amountCents = units * item.unitPriceCents
      itemsSubtotalCents += amountCents
      lines.push({
        kind: 'item',
        label: item.name,
        amountCents,
        units,
        totalUnits: item.quantity,
      })
      continue
    }

    const assignedIds = itemAssignments.map((a) => a.participantId)
    if (!assignedIds.includes(participantId)) continue

    const sortedIds = [...assignedIds].sort((a, b) => {
      const orderA = input.participants.find((p) => p.id === a)?.sortOrder ?? 0
      const orderB = input.participants.find((p) => p.id === b)?.sortOrder ?? 0
      return orderA - orderB
    })

    const share = splitLineTotal(lineTotalCents(item), sortedIds).find(
      (portion) => portion.id === participantId,
    )
    if (!share || share.cents <= 0) continue

    itemsSubtotalCents += share.cents
    lines.push({
      kind: 'item',
      label: item.name,
      amountCents: share.cents,
      sharedWithCount: sortedIds.length > 1 ? sortedIds.length - 1 : undefined,
    })
  }

  const tipTotal = input.tipCents ?? 0
  let tipCents = 0
  if (tipTotal > 0) {
    const sortedParticipantIds = [...input.participants]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => p.id)
    const share = splitLineTotal(tipTotal, sortedParticipantIds).find(
      (portion) => portion.id === participantId,
    )
    tipCents = share?.cents ?? 0
    if (tipCents > 0) {
      lines.push({
        kind: 'tip',
        label: `Бакшиш (1/${sortedParticipantIds.length})`,
        amountCents: tipCents,
      })
    }
  }

  return {
    lines,
    itemsSubtotalCents,
    tipCents,
    owedCents: itemsSubtotalCents + tipCents,
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- --run src/lib/bill-calculations.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/bill-calculations.ts src/lib/bill-calculations.test.ts
git commit -m "$(cat <<'EOF'
Add participant breakdown calculation with invariant tests.

EOF
)"
```

---

### Task 2: Extract shared payment actions

**Files:**

- Create: `src/components/bills/payment-actions.tsx`
- Modify: `src/components/bills/payment-row.tsx`

- [ ] **Step 1: Create `payment-actions.tsx`**

Move payment mutation logic from `PaymentRow` into:

```typescript
import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import type { ParticipantTotals } from '#/lib/bill-calculations.ts'
import { formatEur, parseEurInput } from '#/lib/format-currency.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export interface PaymentActionsProps {
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  totals: ParticipantTotals
}

export function PaymentActions({
  billId,
  participantId,
  label,
  totals,
}: PaymentActionsProps) {
  const addPayment = useMutation(api.payments.add)
  const [partialAmount, setPartialAmount] = useState('')
  const remainingCents = Math.max(0, totals.balanceCents)

  async function handleMarkPaid() {
    if (remainingCents <= 0) return
    await addPayment({ billId, participantId, amountCents: remainingCents })
    toast.success(`${label} плати ${formatEur(remainingCents)}`)
  }

  async function handlePartialPayment() {
    const amountCents = parseEurInput(partialAmount)
    if (amountCents <= 0) return
    setPartialAmount('')
    await addPayment({ billId, participantId, amountCents })
    toast.success(`${label} плати ${formatEur(amountCents)}`)
  }

  if (remainingCents <= 0) return null

  return (
    <div className="flex gap-2 pt-1">
      <Button className="h-11 flex-1" onClick={handleMarkPaid}>
        Платено
      </Button>
      <Input
        value={partialAmount}
        onChange={(e) => setPartialAmount(e.target.value)}
        inputMode="decimal"
        placeholder="Частична сума"
        className="h-11 w-32"
      />
      <Button
        variant="outline"
        className="h-11"
        onClick={handlePartialPayment}
        disabled={!partialAmount.trim()}
      >
        Плати
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Refactor `payment-row.tsx`**

Replace inline payment buttons with `<PaymentActions ... />`. Add optional props:

```typescript
export interface PaymentRowProps {
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  totals: ParticipantTotals
  onOpenDetail?: () => void
}
```

Make name/header tappable when `onOpenDetail` provided:

```typescript
<button
  type="button"
  onClick={onOpenDetail}
  className="flex flex-1 items-center justify-between gap-2 text-left"
>
  <p className="font-medium">{label}</p>
  <Badge ... />
</button>
```

Wrap payment actions div with `onClick={(e) => e.stopPropagation()}` if row becomes fully clickable, or keep row structure with separate tap target on header only.

- [ ] **Step 3: Verify app compiles**

Run: `npm test -- --run`

- [ ] **Step 4: Commit**

```bash
git add src/components/bills/payment-actions.tsx src/components/bills/payment-row.tsx
git commit -m "$(cat <<'EOF'
Extract shared PaymentActions for reuse in participant sheet.

EOF
)"
```

---

### Task 3: Receipt preview card

**Files:**

- Create: `src/components/bills/receipt-preview-card.tsx`

- [ ] **Step 1: Create component**

```typescript
import { useQuery } from 'convex/react'
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import {
  Dialog,
  DialogContent,
} from '#/components/ui/dialog.tsx'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export interface ReceiptPreviewCardProps {
  storageId: Id<'_storage'>
}

export function ReceiptPreviewCard({ storageId }: ReceiptPreviewCardProps) {
  const [open, setOpen] = useState(false)
  const receiptUrl = useQuery(api.files.getUrl, { storageId })

  if (receiptUrl === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Касова бележка</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Зареждане...</p>
        </CardContent>
      </Card>
    )
  }

  if (!receiptUrl) return null

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Касова бележка</CardTitle>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full rounded-md border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <img
              src={receiptUrl}
              alt="Касова бележка"
              className="max-h-64 w-full object-contain"
            />
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Докоснете за по-голям преглед
          </p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto p-2">
          <img
            src={receiptUrl}
            alt="Касова бележка"
            className="h-auto w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bills/receipt-preview-card.tsx
git commit -m "$(cat <<'EOF'
Add receipt preview card with tap-to-expand dialog.

EOF
)"
```

---

### Task 4: Participant detail sheet

**Files:**

- Create: `src/components/bills/participant-detail-sheet.tsx`

- [ ] **Step 1: Create component**

```typescript
import type {
  BillBreakdownInput,
  ParticipantTotals,
  PaymentStatus,
} from '#/lib/bill-calculations.ts'
import {
  calculateParticipantBreakdown,
} from '#/lib/bill-calculations.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { Badge } from '#/components/ui/badge.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { PaymentActions } from '#/components/bills/payment-actions.tsx'
import type { Id } from '../../../convex/_generated/dataModel'

const statusLabels: Record<PaymentStatus, string> = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
}

function formatLineSuffix(line: {
  sharedWithCount?: number
  units?: number
  totalUnits?: number
}): string {
  if (line.units !== undefined && line.totalUnits !== undefined) {
    return ` · ${line.units} от ${line.totalUnits}`
  }
  if (line.sharedWithCount !== undefined && line.sharedWithCount > 0) {
    return ` · споделено с ${line.sharedWithCount}`
  }
  return ''
}

export interface ParticipantDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  breakdownInput: BillBreakdownInput
  totals: ParticipantTotals
}

export function ParticipantDetailSheet({
  open,
  onOpenChange,
  billId,
  participantId,
  label,
  breakdownInput,
  totals,
}: ParticipantDetailSheetProps) {
  const breakdown = calculateParticipantBreakdown(
    breakdownInput,
    participantId,
  )
  const remainingCents = Math.max(0, totals.balanceCents)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] max-w-lg rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2 pr-8">
            <span>{label}</span>
            <Badge variant="outline">{statusLabels[totals.status]}</Badge>
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
          {breakdown.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Няма разпределени артикули.
            </p>
          ) : (
            breakdown.lines.map((line, index) => (
              <div
                key={`${line.kind}-${line.label}-${index}`}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <p className="text-muted-foreground">
                  {line.label}
                  {formatLineSuffix(line)}
                </p>
                <p className="shrink-0 tabular-nums">{formatEur(line.amountCents)}</p>
              </div>
            ))
          )}

          <Separator />

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Дължи</p>
              <p className="tabular-nums font-medium">{formatEur(totals.owedCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Платено</p>
              <p className="tabular-nums font-medium">{formatEur(totals.paidCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Остатък</p>
              <p className="tabular-nums font-medium">{formatEur(remainingCents)}</p>
            </div>
          </div>

          <PaymentActions
            billId={billId}
            participantId={participantId}
            label={label}
            totals={totals}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bills/participant-detail-sheet.tsx
git commit -m "$(cat <<'EOF'
Add participant detail sheet with item/tip breakdown.

EOF
)"
```

---

### Task 5: Wire summary page

**Files:**

- Modify: `src/routes/bills/$billId/summary.tsx`

- [ ] **Step 1: Add imports and state**

```typescript
import { ReceiptPreviewCard } from '#/components/bills/receipt-preview-card.tsx'
import { ParticipantDetailSheet } from '#/components/bills/participant-detail-sheet.tsx'
import type { BillBreakdownInput } from '#/lib/bill-calculations.ts'
import type { Id } from '../../../../convex/_generated/dataModel'

const [detailParticipantId, setDetailParticipantId] =
  useState<Id<'participants'> | null>(null)
```

- [ ] **Step 2: Build breakdown input with item names**

Extend `calcInputs` useMemo or add separate `breakdownInput`:

```typescript
const breakdownInput = useMemo((): BillBreakdownInput | null => {
  if (!data) return null
  return {
    participants: data.participants.map((p) => ({
      id: p._id,
      sortOrder: p.sortOrder,
    })),
    items: data.items.map((i) => ({
      id: i._id,
      name: i.name,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
    })),
    assignments: data.assignments.map((a) => ({
      itemId: a.itemId,
      participantId: a.participantId,
      units: a.units,
    })),
    tipCents: data.bill.tipCents ?? 0,
  }
}, [data])
```

- [ ] **Step 3: Render receipt card after total card**

```typescript
{bill.receiptStorageId && (
  <ReceiptPreviewCard storageId={bill.receiptStorageId} />
)}
```

- [ ] **Step 4: Wire PaymentRow + sheet**

```typescript
<PaymentRow
  ...
  onOpenDetail={() => setDetailParticipantId(participant._id)}
/>

{detailParticipantId && breakdownInput && (
  <ParticipantDetailSheet
    open={detailParticipantId !== null}
    onOpenChange={(open) => {
      if (!open) setDetailParticipantId(null)
    }}
    billId={billId}
    participantId={detailParticipantId}
    label={labels[detailParticipantId] ?? 'Участник'}
    breakdownInput={breakdownInput}
    totals={totals.byParticipant[detailParticipantId]}
  />
)}
```

- [ ] **Step 5: Run full test suite**

Run: `npm test -- --run`  
Expected: all tests pass

- [ ] **Step 6: Manual smoke test**

1. Open a bill with receipt photo on summary — thumbnail visible
2. Tap thumbnail — full image in dialog
3. Tap participant name — sheet with items, tip, totals
4. Mark paid from sheet — row updates

- [ ] **Step 7: Commit**

```bash
git add src/routes/bills/$billId/summary.tsx
git commit -m "$(cat <<'EOF'
Wire receipt preview and participant detail sheet on summary page.

EOF
)"
```

---

### Task 6: Commit spec and plan docs

- [ ] **Step 1: Commit documentation**

```bash
git add docs/superpowers/specs/2026-07-07-summary-receipt-participant-detail-design.md docs/superpowers/plans/2026-07-07-summary-receipt-participant-detail.md
git commit -m "$(cat <<'EOF'
Add spec and plan for summary receipt preview and participant detail.

EOF
)"
```
