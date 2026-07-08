# Guest QR Claim Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the host show a QR code so friends open the bill, pick their name, claim items, and pay via Revolut — while the host still finalizes and confirms payments.

**Architecture:** One join URL per bill (`/bills/$billId/join`) encoded in a client-generated QR. Guest identity stored in `localStorage`. Claim view reuses existing `assignments.toggle` / `setUnits` with draft-bill guards. Host editor gets a `BillInviteCard`; guest routes use simplified mobile UI with sticky personal total + Revolut.

**Tech Stack:** Convex, React, TanStack Router, Shadcn, Vitest, `qrcode` npm package, existing `calculateBillTotals` + `buildRevolutUrl`

**Spec:** `docs/superpowers/specs/2026-07-07-guest-qr-claim-flow-design.md`

---

## File Map

| File                                          | Responsibility                                      |
| --------------------------------------------- | --------------------------------------------------- |
| `src/lib/bill-join-url.ts`                    | Build absolute join URL for QR/link copy            |
| `src/lib/bill-join-url.test.ts`               | URL builder tests                                   |
| `src/lib/guest-participant-session.ts`        | localStorage read/write/clear for guest participant |
| `src/lib/guest-participant-session.test.ts`   | Session storage tests                               |
| `convex/lib/assertAssignmentEditable.ts`      | Pure guard: draft bill + participant on same bill   |
| `src/lib/assert-assignment-editable.test.ts`  | Guard tests (imports convex lib)                    |
| `convex/assignments.ts`                       | Wire guards into `toggle` and `setUnits`            |
| `src/components/bills/bill-invite-card.tsx`   | QR canvas + copy link (host editor)                 |
| `src/components/bills/guest-item-row.tsx`     | Self-scoped item claim row                          |
| `src/components/bills/guest-claim-footer.tsx` | Sticky owed total + Revolut button                  |
| `src/routes/bills/$billId/join.tsx`           | Name picker page                                    |
| `src/routes/bills/$billId/claim.tsx`          | Guest claim page                                    |
| `src/routes/bills/$billId/index.tsx`          | Insert `BillInviteCard` after participants          |
| `src/components/layout/app-header.tsx`        | Header titles/back for join + claim routes          |
| `.env.example`                                | Document optional `VITE_APP_ORIGIN`                 |

---

### Task 1: Join URL helper

**Files:**

- Create: `src/lib/bill-join-url.ts`
- Create: `src/lib/bill-join-url.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import { buildBillJoinPath, buildBillJoinUrl } from './bill-join-url.ts'

describe('buildBillJoinPath', () => {
  it('returns join path for bill id', () => {
    expect(buildBillJoinPath('j57abc123')).toBe('/bills/j57abc123/join')
  })
})

describe('buildBillJoinUrl', () => {
  it('combines origin and join path', () => {
    expect(buildBillJoinUrl('j57abc123', 'https://onova.example.com')).toBe(
      'https://onova.example.com/bills/j57abc123/join',
    )
  })

  it('strips trailing slash from origin', () => {
    expect(buildBillJoinUrl('j57abc123', 'https://onova.example.com/')).toBe(
      'https://onova.example.com/bills/j57abc123/join',
    )
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- --run src/lib/bill-join-url.test.ts`

- [ ] **Step 3: Implement**

```typescript
export function buildBillJoinPath(billId: string): string {
  return `/bills/${billId}/join`
}

export function resolveAppOrigin(fallbackOrigin = ''): string {
  const fromEnv = import.meta.env.VITE_APP_ORIGIN?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, '')
  return ''
}

export function buildBillJoinUrl(billId: string, origin: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}${buildBillJoinPath(billId)}`
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- --run src/lib/bill-join-url.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/bill-join-url.ts src/lib/bill-join-url.test.ts
git commit -m "feat: add bill join URL helpers for guest QR flow"
```

---

### Task 2: Guest participant session (localStorage)

**Files:**

- Create: `src/lib/guest-participant-session.ts`
- Create: `src/lib/guest-participant-session.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearStoredGuestParticipant,
  getStoredGuestParticipant,
  setStoredGuestParticipant,
} from './guest-participant-session.ts'

const STORAGE_KEY = 'onova-guest-participant'

describe('guest-participant-session', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing stored', () => {
    expect(getStoredGuestParticipant('bill_a')).toBeNull()
  })

  it('stores and reads participant for bill', () => {
    setStoredGuestParticipant('bill_a', 'participant_1')
    expect(getStoredGuestParticipant('bill_a')).toBe('participant_1')
  })

  it('clears only matching bill', () => {
    setStoredGuestParticipant('bill_a', 'participant_1')
    setStoredGuestParticipant('bill_b', 'participant_2')
    clearStoredGuestParticipant('bill_a')
    expect(getStoredGuestParticipant('bill_a')).toBeNull()
    expect(getStoredGuestParticipant('bill_b')).toBe('participant_2')
  })

  it('ignores malformed json', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(getStoredGuestParticipant('bill_a')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- --run src/lib/guest-participant-session.test.ts`

- [ ] **Step 3: Implement**

```typescript
const STORAGE_KEY = 'onova-guest-participant'

type StoredGuestSession = {
  billId: string
  participantId: string
}

function readSession(): StoredGuestSession | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as StoredGuestSession
    if (
      typeof parsed.billId === 'string' &&
      typeof parsed.participantId === 'string'
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function getStoredGuestParticipant(billId: string): string | null {
  const session = readSession()
  if (!session || session.billId !== billId) return null
  return session.participantId
}

export function setStoredGuestParticipant(
  billId: string,
  participantId: string,
): void {
  if (typeof localStorage === 'undefined') return
  const payload: StoredGuestSession = { billId, participantId }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function clearStoredGuestParticipant(billId: string): void {
  if (typeof localStorage === 'undefined') return
  const session = readSession()
  if (session?.billId === billId) {
    localStorage.removeItem(STORAGE_KEY)
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- --run src/lib/guest-participant-session.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/guest-participant-session.ts src/lib/guest-participant-session.test.ts
git commit -m "feat: persist guest participant selection in localStorage"
```

---

### Task 3: Assignment mutation guards

**Files:**

- Create: `convex/lib/assertAssignmentEditable.ts`
- Create: `src/lib/assert-assignment-editable.test.ts`
- Modify: `convex/assignments.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest'
import { getAssignmentEditableError } from '../../convex/lib/assertAssignmentEditable'

describe('getAssignmentEditableError', () => {
  it('returns bill_final when bill is final', () => {
    expect(
      getAssignmentEditableError({
        billStatus: 'final',
        itemBillId: 'bill_1',
        participantBillId: 'bill_1',
      }),
    ).toBe('bill_final')
  })

  it('returns participant_not_on_bill when participant bill mismatches', () => {
    expect(
      getAssignmentEditableError({
        billStatus: 'draft',
        itemBillId: 'bill_1',
        participantBillId: 'bill_2',
      }),
    ).toBe('participant_not_on_bill')
  })

  it('returns null when editable', () => {
    expect(
      getAssignmentEditableError({
        billStatus: 'draft',
        itemBillId: 'bill_1',
        participantBillId: 'bill_1',
      }),
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- --run src/lib/assert-assignment-editable.test.ts`

- [ ] **Step 3: Implement guard helper**

Create `convex/lib/assertAssignmentEditable.ts`:

```typescript
import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'

export type AssignmentEditableError = 'bill_final' | 'participant_not_on_bill'

export function getAssignmentEditableError(input: {
  billStatus: 'draft' | 'final'
  itemBillId: Id<'bills'>
  participantBillId: Id<'bills'> | null | undefined
}): AssignmentEditableError | null {
  if (input.billStatus === 'final') return 'bill_final'
  if (
    !input.participantBillId ||
    input.participantBillId !== input.itemBillId
  ) {
    return 'participant_not_on_bill'
  }
  return null
}

const errorMessages: Record<AssignmentEditableError, string> = {
  bill_final: 'Сметката е приключена и не може да се редактира.',
  participant_not_on_bill: 'Участникът не принадлежи на тази сметка.',
}

export function assertAssignmentEditable(input: {
  billStatus: 'draft' | 'final'
  itemBillId: Id<'bills'>
  participantBillId: Id<'bills'> | null | undefined
}): void {
  const error = getAssignmentEditableError(input)
  if (error) throw new ConvexError(errorMessages[error])
}
```

- [ ] **Step 4: Wire into `convex/assignments.ts`**

At top of file add import:

```typescript
import { assertAssignmentEditable } from './lib/assertAssignmentEditable'
```

In `toggle` handler, after loading `item`, add:

```typescript
const bill = await ctx.db.get(item.billId)
if (!bill) return
const participant = await ctx.db.get(args.participantId)
assertAssignmentEditable({
  billStatus: bill.status,
  itemBillId: item.billId,
  participantBillId: participant?.billId,
})
```

Add the same block at the start of `setUnits` handler (after loading `item`).

- [ ] **Step 5: Run test — expect PASS**

Run: `npm test -- --run src/lib/assert-assignment-editable.test.ts`

- [ ] **Step 6: Commit**

```bash
git add convex/lib/assertAssignmentEditable.ts convex/assignments.ts src/lib/assert-assignment-editable.test.ts
git commit -m "feat: block assignment changes on final bills or wrong participant"
```

---

### Task 4: QR dependency + BillInviteCard

**Files:**

- Modify: `package.json` (add `qrcode` + `@types/qrcode`)
- Create: `src/components/bills/bill-invite-card.tsx`
- Modify: `.env.example`

- [ ] **Step 1: Install QR library**

Run: `pnpm add qrcode && pnpm add -D @types/qrcode`

- [ ] **Step 2: Document optional origin env**

Add to `.env.example` under frontend section:

```
# Optional — used for QR/link copy when window.origin unavailable at build time:
# VITE_APP_ORIGIN=https://your-site.netlify.app
```

- [ ] **Step 3: Create `BillInviteCard`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { LinkIcon, QrCodeIcon } from 'lucide-react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { buildBillJoinUrl, resolveAppOrigin } from '#/lib/bill-join-url.ts'
import type { Id } from '../../../convex/_generated/dataModel'

export interface BillInviteCardProps {
  billId: Id<'bills'>
  disabled?: boolean
}

export function BillInviteCard({ billId, disabled }: BillInviteCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [joinUrl, setJoinUrl] = useState('')

  useEffect(() => {
    const origin = resolveAppOrigin(window.location.origin)
    const url = buildBillJoinUrl(billId, origin)
    setJoinUrl(url)
    if (!canvasRef.current || disabled) return
    void QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 1,
      color: { dark: '#173a40', light: '#ffffff' },
    })
  }, [billId, disabled])

  async function handleCopyLink() {
    if (!joinUrl) return
    try {
      await navigator.clipboard.writeText(joinUrl)
      toast.success('Линкът е копиран')
    } catch {
      toast.error('Неуспешно копиране')
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-2 self-start text-sm font-medium">
        <QrCodeIcon className={ICON.section} aria-hidden />
        Покани приятели
      </div>
      {disabled ? (
        <p className="self-start text-sm text-muted-foreground">
          Добавете поне един участник, за да покажете QR код.
        </p>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            className="rounded-md border bg-white p-2"
            aria-label="QR код за присъединяване към сметката"
          />
          <p className="text-center text-xs text-muted-foreground">
            Приятелите сканират QR кода, избират името си и отбелязват какво са
            консумирали. Използвайте само с хора на масата.
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={handleCopyLink}
          >
            <LinkIcon className={ICON.button} aria-hidden />
            Копирай линк
          </Button>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire into bill editor**

In `src/routes/bills/$billId/index.tsx`:

1. Import `BillInviteCard`
2. After `ParticipantList` card (before Items card), insert:

```tsx
<BillInviteCard billId={billId} disabled={participants.length === 0} />
```

Place inside the Participants `CardContent`, below `ParticipantList`.

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: PASS (routes unchanged yet — card only)

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/bills/bill-invite-card.tsx src/routes/bills/$billId/index.tsx .env.example
git commit -m "feat: add QR invite card to bill editor"
```

---

### Task 5: Join page route

**Files:**

- Create: `src/routes/bills/$billId/join.tsx`
- Modify: `src/components/layout/app-header.tsx`

- [ ] **Step 1: Create join route**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { formatEur } from '#/lib/format-currency.ts'
import {
  getStoredGuestParticipant,
  setStoredGuestParticipant,
} from '#/lib/guest-participant-session.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/join')({
  component: BillJoinPage,
})

function BillJoinPage() {
  const { billId: billIdParam } = Route.useParams()
  const billId = billIdParam as Id<'bills'>
  const navigate = useNavigate()
  const data = useQuery(api.bills.get, { billId })

  useEffect(() => {
    const stored = getStoredGuestParticipant(billId)
    if (stored) {
      void navigate({ to: '/bills/$billId/claim', params: { billId } })
    }
  }, [billId, navigate])

  if (data === undefined) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  if (data === null) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Сметката не е намерена.
      </div>
    )
  }

  const { bill, participants } = data
  const labels = buildParticipantLabels(participants)
  const sorted = [...participants].sort((a, b) => a.sortOrder - b.sortOrder)
  const restaurantName = bill.restaurantName.trim() || 'Сметка'
  const dateLabel = new Intl.DateTimeFormat('bg-BG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(bill.date))

  function handlePick(participantId: Id<'participants'>) {
    setStoredGuestParticipant(billId, participantId)
    void navigate({ to: '/bills/$billId/claim', params: { billId } })
  }

  return (
    <div className="page-container flex flex-col gap-6 py-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
        <h2 className="text-xl font-semibold">{restaurantName}</h2>
      </div>

      {bill.status === 'final' ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Сметката е приключена.
          </p>
          <Button
            className="h-11"
            onClick={() =>
              void navigate({ to: '/bills/$billId/claim', params: { billId } })
            }
          >
            Виж моя дял
          </Button>
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Очаква се домакинът да добави участници.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-medium">Кой сте вие?</h3>
          <div className="flex flex-col gap-2">
            {sorted.map((participant) => (
              <Button
                key={participant._id}
                type="button"
                variant="outline"
                className="h-12 justify-start text-base"
                onClick={() => handlePick(participant._id)}
              >
                {labels[participant._id] ?? participant.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Обща сума: {formatEur(bill.tipCents ?? 0)}
      </p>
    </div>
  )
}
```

**Fix before commit:** Replace the bottom „Обща сума“ line — it incorrectly shows tip only. Remove that `<p>` entirely (totals belong on claim page).

- [ ] **Step 2: Update app header for join route**

In `useHeaderConfig()` inside `app-header.tsx`, add before the final fallback return:

```typescript
const isJoin = pathname.endsWith('/join')
const isClaim = pathname.endsWith('/claim')

if ((isJoin || isClaim) && billId) {
  return {
    title: isJoin ? 'Присъедини се' : 'Моят дял',
    backTo: null,
    backParams: undefined,
  }
}
```

- [ ] **Step 3: Regenerate routes**

Run: `npm run generate-routes`

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/bills/$billId/join.tsx src/components/layout/app-header.tsx src/routeTree.gen.ts
git commit -m "feat: add guest join page with participant name picker"
```

---

### Task 6: Guest item row component

**Files:**

- Create: `src/components/bills/guest-item-row.tsx`

- [ ] **Step 1: Create component**

```tsx
import { useMutation } from 'convex/react'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface GuestItemRowProps {
  item: Doc<'items'>
  participantId: Id<'participants'>
  itemAssignments: Doc<'itemAssignments'>[]
  readOnly: boolean
}

export function GuestItemRow({
  item,
  participantId,
  itemAssignments,
  readOnly,
}: GuestItemRowProps) {
  const toggleAssignment = useMutation(api.assignments.toggle)
  const setUnits = useMutation(api.assignments.setUnits)

  const myAssignment = itemAssignments.find(
    (assignment) => assignment.participantId === participantId,
  )
  const myUnits = myAssignment?.units ?? 0
  const assignedUnitsTotal = itemAssignments.reduce(
    (sum, assignment) => sum + (assignment.units ?? 0),
    0,
  )
  const otherAssigneeCount = itemAssignments.filter(
    (assignment) => assignment.participantId !== participantId,
  ).length
  const lineTotalCents = item.unitPriceCents * item.quantity

  if (item.quantity === 1) {
    const isClaimed = myUnits > 0
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() =>
          void toggleAssignment({ itemId: item._id, participantId })
        }
        className={cn(
          'tap-feedback flex w-full flex-col gap-1 rounded-lg border p-4 text-left',
          isClaimed
            ? 'border-primary/50 bg-primary/10'
            : 'border-border bg-card',
          readOnly && 'opacity-80',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatEur(item.unitPriceCents)} × {item.quantity}
            </p>
          </div>
          <p className="font-medium tabular-nums">
            {formatEur(lineTotalCents)}
          </p>
        </div>
        {otherAssigneeCount > 0 && (
          <p className="text-xs text-muted-foreground">
            +{otherAssigneeCount} други
          </p>
        )}
        {!readOnly && (
          <p className="text-xs font-medium text-primary">
            {isClaimed ? 'Отбелязано' : 'Докоснете, за да отбележите'}
          </p>
        )}
      </button>
    )
  }

  const remainingUnits = Math.max(
    0,
    item.quantity - assignedUnitsTotal + myUnits,
  )

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatEur(item.unitPriceCents)} × {item.quantity}
          </p>
        </div>
        <p className="font-medium tabular-nums">{formatEur(lineTotalCents)}</p>
      </div>
      {otherAssigneeCount > 0 && (
        <p className="text-xs text-muted-foreground">
          +{otherAssigneeCount} други · {assignedUnitsTotal}/{item.quantity}{' '}
          разпределени
        </p>
      )}
      {!readOnly && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Ваши бройки</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Намали"
              disabled={myUnits <= 0}
              onClick={() =>
                void setUnits({
                  itemId: item._id,
                  participantId,
                  units: myUnits - 1,
                })
              }
              className="flex size-9 items-center justify-center rounded-full border disabled:opacity-40"
            >
              <MinusIcon className="size-4" />
            </button>
            <span className="min-w-8 text-center font-medium tabular-nums">
              {myUnits}
            </span>
            <button
              type="button"
              aria-label="Увеличи"
              disabled={myUnits >= remainingUnits}
              onClick={() =>
                void setUnits({
                  itemId: item._id,
                  participantId,
                  units: myUnits + 1,
                })
              }
              className="flex size-9 items-center justify-center rounded-full border disabled:opacity-40"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bills/guest-item-row.tsx
git commit -m "feat: add guest item claim row component"
```

---

### Task 7: Guest claim footer

**Files:**

- Create: `src/components/bills/guest-claim-footer.tsx`

- [ ] **Step 1: Create component**

```tsx
import { SendIcon } from 'lucide-react'
import { useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { formatCopyAmount } from '#/lib/bill-share.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { buildRevolutUrl } from '#/lib/payment-settings.ts'
import { api } from '../../../convex/_generated/api'

export interface GuestClaimFooterProps {
  owedCents: number
  remainingCents: number
}

export function GuestClaimFooter({
  owedCents,
  remainingCents,
}: GuestClaimFooterProps) {
  const settings = useQuery(api.paymentSettings.get)
  const revolutUsername = settings?.revolutUsername?.trim()

  async function handleRevolut() {
    if (!revolutUsername || remainingCents <= 0) return
    try {
      await navigator.clipboard.writeText(formatCopyAmount(remainingCents))
    } catch {
      toast.error('Неуспешно копиране')
      return
    }
    window.open(buildRevolutUrl(revolutUsername, remainingCents))
    toast.success('Отворен Revolut')
  }

  return (
    <>
      <div aria-hidden className="sticky-totals-bar-spacer" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Вашият дял</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatEur(owedCents)}
              </p>
            </div>
            <Button
              type="button"
              className="h-11"
              disabled={!revolutUsername || remainingCents <= 0}
              onClick={handleRevolut}
            >
              <SendIcon className={ICON.button} aria-hidden />
              Revolut
            </Button>
          </div>
          {!revolutUsername ? (
            <p className="text-xs text-muted-foreground">
              Попитайте домакина за Revolut.
            </p>
          ) : remainingCents <= 0 ? (
            <p className="text-xs text-muted-foreground">
              Няма оставащо за плащане.
            </p>
          ) : null}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/bills/guest-claim-footer.tsx
git commit -m "feat: add guest sticky footer with Revolut pay action"
```

---

### Task 8: Claim page route

**Files:**

- Create: `src/routes/bills/$billId/claim.tsx`

- [ ] **Step 1: Create claim route**

```tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect, useMemo } from 'react'
import { GuestClaimFooter } from '#/components/bills/guest-claim-footer.tsx'
import { GuestItemRow } from '#/components/bills/guest-item-row.tsx'
import { Button } from '#/components/ui/button.tsx'
import { calculateBillTotals } from '#/lib/bill-calculations.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import {
  clearStoredGuestParticipant,
  getStoredGuestParticipant,
} from '#/lib/guest-participant-session.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

export const Route = createFileRoute('/bills/$billId/claim')({
  component: BillClaimPage,
})

function BillClaimPage() {
  const { billId: billIdParam } = Route.useParams()
  const billId = billIdParam as Id<'bills'>
  const navigate = useNavigate()
  const data = useQuery(api.bills.get, { billId })

  const storedParticipantId = useMemo(
    () => getStoredGuestParticipant(billId),
    [billId],
  )

  useEffect(() => {
    if (!storedParticipantId) {
      void navigate({ to: '/bills/$billId/join', params: { billId } })
    }
  }, [billId, navigate, storedParticipantId])

  const totals = useMemo(() => {
    if (!data || !storedParticipantId) return null
    return calculateBillTotals({
      participants: data.participants.map((p) => ({
        id: p._id,
        sortOrder: p.sortOrder,
      })),
      items: data.items.map((i) => ({
        id: i._id,
        unitPriceCents: i.unitPriceCents,
        quantity: i.quantity,
      })),
      assignments: data.assignments.map((a) => ({
        itemId: a.itemId,
        participantId: a.participantId,
        units: a.units,
      })),
      payments: data.payments.map((p) => ({
        participantId: p.participantId,
        amountCents: p.amountCents,
      })),
      tipCents: data.bill.tipCents ?? 0,
    })
  }, [data, storedParticipantId])

  if (!storedParticipantId) {
    return null
  }

  if (data === undefined) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  if (data === null) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Сметката не е намерена.
      </div>
    )
  }

  const participant = data.participants.find(
    (p) => p._id === storedParticipantId,
  )
  if (!participant) {
    clearStoredGuestParticipant(billId)
    void navigate({ to: '/bills/$billId/join', params: { billId } })
    return null
  }

  const labels = buildParticipantLabels(data.participants)
  const label = labels[participant._id] ?? participant.name
  const readOnly = data.bill.status === 'final'
  const sortedItems = [...data.items].sort((a, b) => a.sortOrder - b.sortOrder)
  const participantTotals = totals?.byParticipant[storedParticipantId]

  function handleSwitchIdentity() {
    clearStoredGuestParticipant(billId)
    void navigate({ to: '/bills/$billId/join', params: { billId } })
  }

  return (
    <div className="page-container pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {data.bill.restaurantName.trim() || 'Сметка'}
          </p>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Вие сте: {label}</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSwitchIdentity}
            >
              Не съм {label}
            </Button>
          </div>
          {readOnly && (
            <p className="text-sm text-muted-foreground">
              Сметката е приключена — само преглед.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {sortedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Все още няма артикули.
            </p>
          ) : (
            sortedItems.map((item) => (
              <GuestItemRow
                key={item._id}
                item={item}
                participantId={storedParticipantId}
                itemAssignments={data.assignments.filter(
                  (assignment) => assignment.itemId === item._id,
                )}
                readOnly={readOnly}
              />
            ))
          )}
        </div>
      </div>

      {participantTotals && (
        <GuestClaimFooter
          owedCents={participantTotals.owedCents}
          remainingCents={participantTotals.remainingCents}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Regenerate routes**

Run: `npm run generate-routes`

- [ ] **Step 3: Run full preflight**

Run: `npm run preflight`
Expected: all tests PASS, build PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/bills/$billId/claim.tsx src/routeTree.gen.ts
git commit -m "feat: add guest claim page with item selection and Revolut pay"
```

---

### Task 9: Final verification

**Files:**

- Modify: `docs/superpowers/specs/2026-07-07-guest-qr-claim-flow-design.md` (status → Approved)

- [ ] **Step 1: Manual smoke test**

1. Host: create bill → add 2 participants → add/import items → verify QR renders in editor
2. Copy join link → open in second browser tab (guest)
3. Guest: pick name → claim 1–2 items → verify total updates
4. Host editor: verify assignments appear live
5. Guest: tap Revolut → URL contains integer cents
6. Guest: „Не съм …“ → re-pick name
7. Host: assign remaining items → finalize
8. Guest claim page → read-only, Revolut still works

- [ ] **Step 2: Update spec status**

In `docs/superpowers/specs/2026-07-07-guest-qr-claim-flow-design.md`, change `Status: Draft — pending user review` to `Status: Approved`.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-07-07-guest-qr-claim-flow-design.md
git commit -m "docs: approve guest QR claim flow spec"
```

---

## Spec Coverage Checklist

| Spec requirement                      | Task                         |
| ------------------------------------- | ---------------------------- |
| Join route + name picker              | Task 5                       |
| Claim route + item toggles            | Tasks 6, 8                   |
| localStorage guest session            | Task 2                       |
| QR + copy link on host editor         | Task 4                       |
| Revolut on guest footer               | Task 7                       |
| Draft-only assignment edits           | Task 3                       |
| Read-only after finalize              | Tasks 6, 8 (`readOnly` prop) |
| Host unchanged assignment UI          | No changes needed            |
| Invalid participant redirect          | Task 8                       |
| Optional `VITE_APP_ORIGIN`            | Task 4                       |
| Unit tests for URL + session + guards | Tasks 1, 2, 3                |

## Out of Scope (confirmed not in plan)

- Auth / per-person tokens
- Guest self-mark-paid
- QR on summary page
- Separate live dashboard
