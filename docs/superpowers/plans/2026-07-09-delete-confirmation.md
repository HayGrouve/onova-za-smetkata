# Delete Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require an explicit confirmation dialog before every destructive/red action in the app, using one shared AlertDialog provider and centralized Bulgarian copy.

**Architecture:** Install shadcn `AlertDialog`, add `ConfirmActionProvider` at the app root with imperative `useConfirmAction()` API, centralize copy in `destructive-action-copy.ts`, and wrap each existing delete handler with `if (!(await confirm(...))) return` before running mutations. Post-delete undo toasts on items/participants stay unchanged.

**Tech Stack:** React 19, Radix AlertDialog (via shadcn), TanStack Start, Vitest, Sonner toasts

**Spec:** `docs/superpowers/specs/2026-07-09-delete-confirmation-design.md`

**Status:** ✅ Complete

---

## File structure

| File | Responsibility |
|------|----------------|
| `src/components/ui/alert-dialog.tsx` | shadcn AlertDialog primitives |
| `src/lib/confirm-action-state.ts` | Pure promise queue (testable without DOM) |
| `src/lib/confirm-action-state.test.ts` | Unit tests for open/resolve/cancel/supersede |
| `src/lib/destructive-action-copy.ts` | Bulgarian `ConfirmOptions` templates |
| `src/lib/destructive-action-copy.test.ts` | Copy interpolation + non-empty titles |
| `src/components/confirm-action-provider.tsx` | Context, provider, hook, mounted AlertDialog |
| `src/routes/__root.tsx` | Mount provider inside `ThemeProvider` |
| `src/components/bills/bill-card.tsx` | Refactor bill delete → provider |
| `src/components/bills/bill-summary-content.tsx` | Refactor bill delete → provider |
| `src/components/bills/item-list.tsx` | Confirm before item delete |
| `src/components/bills/participant-list.tsx` | Confirm before participant remove |
| `src/components/bills/friend-group-editor-sheet.tsx` | Confirm group delete + member chip |
| `src/components/bills/participant-breakdown-content.tsx` | Confirm guest claim unassign |
| `src/components/bills/payment-actions.tsx` | Confirm payment undo |
| `src/components/layout/app-header-menu.tsx` | Confirm sign-out |

---

## Task 1: Install AlertDialog + copy module

**Files:**
- Create: `src/components/ui/alert-dialog.tsx` (via shadcn CLI)
- Create: `src/lib/destructive-action-copy.ts`
- Create: `src/lib/destructive-action-copy.test.ts`

- [ ] **Step 1: Install shadcn AlertDialog**

Run:

```bash
pnpm dlx shadcn@latest add alert-dialog
```

Expected: creates `src/components/ui/alert-dialog.tsx` matching existing `dialog.tsx` patterns (`radix-ui` import, `data-slot` attrs, `cn()`).

- [ ] **Step 2: Create copy module**

Create `src/lib/destructive-action-copy.ts`:

```ts
export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'destructive' | 'default'
}

const DEFAULTS = {
  confirmLabel: 'Потвърди',
  cancelLabel: 'Отказ',
  variant: 'destructive' as const,
}

function withDefaults(options: ConfirmOptions): Required<ConfirmOptions> {
  return {
    description: options.description ?? '',
    confirmLabel: options.confirmLabel ?? DEFAULTS.confirmLabel,
    cancelLabel: options.cancelLabel ?? DEFAULTS.cancelLabel,
    variant: options.variant ?? DEFAULTS.variant,
    title: options.title,
  }
}

export function getBillDeleteCopy(): ConfirmOptions {
  return withDefaults({
    title: 'Изтриване на сметка?',
    description:
      'Това действие е необратимо. Всички участници, артикули и плащания ще бъдат изтрити.',
    confirmLabel: 'Изтрий сметката',
  })
}

export function getItemDeleteCopy(name: string): ConfirmOptions {
  return withDefaults({
    title: 'Изтриване на артикул?',
    description: `„${name}" ще бъде премахнат от сметката.`,
    confirmLabel: 'Изтрий',
  })
}

export function getParticipantRemoveCopy(name: string): ConfirmOptions {
  return withDefaults({
    title: 'Премахване на участник?',
    description: `„${name}" и разпределенията му ще бъдат премахнати.`,
    confirmLabel: 'Премахни',
  })
}

export function getFriendGroupDeleteCopy(name: string): ConfirmOptions {
  return withDefaults({
    title: 'Изтриване на групата?',
    description: `Групата „${name}" ще бъде изтрита завинаги.`,
    confirmLabel: 'Изтрий групата',
  })
}

export function getFriendGroupMemberRemoveCopy(name: string): ConfirmOptions {
  return withDefaults({
    title: 'Премахване от групата?',
    description: `„${name}" ще бъде премахнат от списъка (промяната се записва при „Запази").`,
    confirmLabel: 'Премахни',
  })
}

export function getClaimUnassignCopy(name: string): ConfirmOptions {
  return withDefaults({
    title: 'Премахване на артикул?',
    description: `„${name}" ще бъде премахнат от вашата част.`,
    confirmLabel: 'Премахни',
  })
}

export function getPaymentUndoCopy(): ConfirmOptions {
  return withDefaults({
    title: 'Отмяна на последното плащане?',
    description: 'Последното записано плащане ще бъде отменено.',
    confirmLabel: 'Отмени плащането',
  })
}

export function getSignOutCopy(): ConfirmOptions {
  return withDefaults({
    title: 'Изход от профила?',
    description: 'Ще бъдете изведени от акаунта си.',
    confirmLabel: 'Изход',
  })
}
```

- [ ] **Step 3: Write failing copy tests**

Create `src/lib/destructive-action-copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  getBillDeleteCopy,
  getClaimUnassignCopy,
  getFriendGroupDeleteCopy,
  getFriendGroupMemberRemoveCopy,
  getItemDeleteCopy,
  getParticipantRemoveCopy,
  getPaymentUndoCopy,
  getSignOutCopy,
} from './destructive-action-copy'

describe('destructive-action-copy', () => {
  it('bill delete has irreversible warning', () => {
    const copy = getBillDeleteCopy()
    expect(copy.title).toBe('Изтриване на сметка?')
    expect(copy.description).toContain('необратимо')
    expect(copy.confirmLabel).toBe('Изтрий сметката')
  })

  it('interpolates item name', () => {
    expect(getItemDeleteCopy('Салата').description).toContain('Салата')
  })

  it('interpolates participant name', () => {
    expect(getParticipantRemoveCopy('Иван').description).toContain('Иван')
  })

  it('interpolates friend group name', () => {
    expect(getFriendGroupDeleteCopy('Колеги').description).toContain('Колеги')
  })

  it('interpolates friend group member name', () => {
    expect(getFriendGroupMemberRemoveCopy('Мария').description).toContain(
      'Мария',
    )
  })

  it('interpolates claim line name', () => {
    expect(getClaimUnassignCopy('Бира').description).toContain('Бира')
  })

  it('payment undo copy is non-empty', () => {
    const copy = getPaymentUndoCopy()
    expect(copy.title.length).toBeGreaterThan(0)
    expect(copy.confirmLabel).toBe('Отмени плащането')
  })

  it('sign out copy is non-empty', () => {
    const copy = getSignOutCopy()
    expect(copy.title).toBe('Изход от профила?')
    expect(copy.confirmLabel).toBe('Изход')
  })
})
```

- [ ] **Step 4: Run copy tests**

Run: `pnpm exec vitest run src/lib/destructive-action-copy.test.ts`
Expected: PASS

---

## Task 2: Confirm state machine + provider

**Files:**
- Create: `src/lib/confirm-action-state.ts`
- Create: `src/lib/confirm-action-state.test.ts`
- Create: `src/components/confirm-action-provider.tsx`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Write confirm state machine**

Create `src/lib/confirm-action-state.ts`:

```ts
import type { ConfirmOptions } from '#/lib/destructive-action-copy.ts'

export type ConfirmRequest = Required<ConfirmOptions>

type Pending = {
  request: ConfirmRequest
  resolve: (confirmed: boolean) => void
}

export function createConfirmActionState() {
  let pending: Pending | null = null

  function requestConfirm(request: ConfirmRequest): Promise<boolean> {
    if (pending) {
      pending.resolve(false)
    }
    return new Promise<boolean>((resolve) => {
      pending = { request, resolve }
    })
  }

  function resolveConfirm(confirmed: boolean) {
    if (!pending) return
    pending.resolve(confirmed)
    pending = null
  }

  function cancelConfirm() {
    resolveConfirm(false)
  }

  function getPendingRequest(): ConfirmRequest | null {
    return pending?.request ?? null
  }

  return {
    requestConfirm,
    resolveConfirm,
    cancelConfirm,
    getPendingRequest,
  }
}
```

- [ ] **Step 2: Write failing state tests**

Create `src/lib/confirm-action-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createConfirmActionState } from './confirm-action-state'

const sample = {
  title: 'Test?',
  description: 'Desc',
  confirmLabel: 'OK',
  cancelLabel: 'Cancel',
  variant: 'destructive' as const,
}

describe('createConfirmActionState', () => {
  it('resolves true on confirm', async () => {
    const state = createConfirmActionState()
    const promise = state.requestConfirm(sample)
    expect(state.getPendingRequest()?.title).toBe('Test?')
    state.resolveConfirm(true)
    await expect(promise).resolves.toBe(true)
    expect(state.getPendingRequest()).toBeNull()
  })

  it('resolves false on cancel', async () => {
    const state = createConfirmActionState()
    const promise = state.requestConfirm(sample)
    state.cancelConfirm()
    await expect(promise).resolves.toBe(false)
  })

  it('supersedes previous pending with false', async () => {
    const state = createConfirmActionState()
    const first = state.requestConfirm(sample)
    const second = state.requestConfirm({ ...sample, title: 'Second?' })
    await expect(first).resolves.toBe(false)
    state.resolveConfirm(true)
    await expect(second).resolves.toBe(true)
  })
})
```

- [ ] **Step 3: Run state tests**

Run: `pnpm exec vitest run src/lib/confirm-action-state.test.ts`
Expected: PASS

- [ ] **Step 4: Create ConfirmActionProvider**

Create `src/components/confirm-action-provider.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog.tsx'
import { buttonVariants } from '#/components/ui/button.tsx'
import { cn } from '#/lib/utils.ts'
import type { ConfirmOptions } from '#/lib/destructive-action-copy.ts'
import { createConfirmActionState } from '#/lib/confirm-action-state.ts'

type ConfirmActionContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmActionContext = createContext<ConfirmActionContextValue | null>(
  null,
)

export function ConfirmActionProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef(createConfirmActionState())
  const [open, setOpen] = useState(false)
  const [request, setRequest] = useState<
    ReturnType<typeof stateRef.current.getPendingRequest>
  >(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const close = useCallback((confirmed: boolean) => {
    stateRef.current.resolveConfirm(confirmed)
    setOpen(false)
    setRequest(null)
    setIsConfirming(false)
  }, [])

  const confirm = useCallback(async (options: ConfirmOptions) => {
    const full = {
      title: options.title,
      description: options.description ?? '',
      confirmLabel: options.confirmLabel ?? 'Потвърди',
      cancelLabel: options.cancelLabel ?? 'Отказ',
      variant: options.variant ?? 'destructive',
    } as const

    setRequest(full)
    setOpen(true)
    setIsConfirming(false)
    return stateRef.current.requestConfirm(full)
  }, [])

  const value = useMemo(() => ({ confirm }), [confirm])

  return (
    <ConfirmActionContext.Provider value={value}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isConfirming) close(false)
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            {request?.description ? (
              <AlertDialogDescription>{request.description}</AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>
              {request?.cancelLabel ?? 'Отказ'}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isConfirming}
              aria-busy={isConfirming}
              className={cn(
                request?.variant === 'destructive' &&
                  buttonVariants({ variant: 'destructive' }),
              )}
              onClick={(event) => {
                event.preventDefault()
                setIsConfirming(true)
                close(true)
              }}
            >
              {request?.confirmLabel ?? 'Потвърди'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmActionContext.Provider>
  )
}

export function useConfirmAction() {
  const ctx = useContext(ConfirmActionContext)
  if (!ctx) {
    throw new Error('useConfirmAction must be used within ConfirmActionProvider')
  }
  return ctx
}
```

- [ ] **Step 5: Mount provider in root**

In `src/routes/__root.tsx`, import and wrap inside `ThemeProvider` (around `ConvexProvider`):

```tsx
import { ConfirmActionProvider } from '#/components/confirm-action-provider.tsx'

// inside ThemeProvider:
<ConfirmActionProvider>
  <ConvexProvider>
    ...
  </ConvexProvider>
</ConfirmActionProvider>
```

- [ ] **Step 6: Run preflight**

Run: `pnpm run preflight`
Expected: PASS (no consumer wiring yet; provider compiles)

---

## Task 3: Refactor bill delete dialogs

**Files:**
- Modify: `src/components/bills/bill-card.tsx`
- Modify: `src/components/bills/bill-summary-content.tsx`

- [ ] **Step 1: Refactor `bill-card.tsx`**

Remove: `Dialog` imports, `deleteOpen` state, `<Dialog>` JSX block.

Add:

```tsx
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { getBillDeleteCopy } from '#/lib/destructive-action-copy.ts'

// in component:
const { confirm } = useConfirmAction()

async function handleDeleteWithConfirm() {
  const confirmed = await confirm(getBillDeleteCopy())
  if (!confirmed) return
  setIsDeleting(true)
  try {
    await removeBill({ billId: bill._id })
  } catch {
    toast.error('Неуспешно изтриване на сметката')
  } finally {
    setIsDeleting(false)
  }
}
```

Change dropdown item:

```tsx
<DropdownMenuItem
  variant="destructive"
  disabled={isDeleting}
  onSelect={(e) => {
    e.preventDefault()
    void handleDeleteWithConfirm()
  }}
>
```

- [ ] **Step 2: Refactor `bill-summary-content.tsx`**

Same pattern: remove local delete `Dialog` + `deleteOpen` + `DialogTrigger` on Изтрий button.

Replace delete button:

```tsx
<Button
  variant="destructive"
  className={cn('h-11', isDraft && !embedded ? 'flex-1' : 'w-full')}
  disabled={isDeleting}
  onClick={() => void handleDeleteWithConfirm()}
>
```

Add `handleDeleteWithConfirm` using `confirm(getBillDeleteCopy())` then existing `handleDelete` body.

- [ ] **Step 3: Verify no duplicate bill delete dialogs**

Run: `rg 'Изтриване на сметка' src/components/bills/bill-card.tsx src/components/bills/bill-summary-content.tsx`
Expected: no matches (copy lives in `destructive-action-copy.ts` only)

- [ ] **Step 4: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

---

## Task 4: Item + participant delete confirms

**Files:**
- Modify: `src/components/bills/item-list.tsx`
- Modify: `src/components/bills/participant-list.tsx`

- [ ] **Step 1: Wire item delete confirm**

In `item-list.tsx`:

```tsx
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { getItemDeleteCopy } from '#/lib/destructive-action-copy.ts'

const { confirm } = useConfirmAction()

async function handleDeleteWithConfirm(item: Doc<'items'>) {
  const confirmed = await confirm(getItemDeleteCopy(item.name))
  if (!confirmed) return
  await handleDelete(item)
}
```

Change `ItemRow` prop: `onDelete={() => void handleDeleteWithConfirm(item)}`.

Keep `handleDelete` unchanged (mutation + undo toast).

- [ ] **Step 2: Wire participant remove confirm**

In `participant-list.tsx`:

```tsx
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { getParticipantRemoveCopy } from '#/lib/destructive-action-copy.ts'

const { confirm } = useConfirmAction()

async function handleRemoveWithConfirm(participant: Doc<'participants'>) {
  const label = labels[participant._id] ?? participant.name
  const confirmed = await confirm(getParticipantRemoveCopy(label))
  if (!confirmed) return
  await handleRemove(participant)
}
```

Change chip button: `onClick={() => void handleRemoveWithConfirm(participant)}`.

- [ ] **Step 3: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

---

## Task 5: Friend groups confirm

**Files:**
- Modify: `src/components/bills/friend-group-editor-sheet.tsx`

- [ ] **Step 1: Confirm group delete**

```tsx
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import {
  getFriendGroupDeleteCopy,
  getFriendGroupMemberRemoveCopy,
} from '#/lib/destructive-action-copy.ts'

const { confirm } = useConfirmAction()

async function handleDeleteWithConfirm() {
  const name = existing?.name ?? 'групата'
  const confirmed = await confirm(getFriendGroupDeleteCopy(name))
  if (!confirmed) return
  await handleDelete()
}
```

Wire footer button: `onClick={() => void handleDeleteWithConfirm()}`.

- [ ] **Step 2: Confirm member chip remove (local draft)**

Replace direct `removeMember(index)` call:

```tsx
async function removeMemberWithConfirm(index: number) {
  const name = memberNames[index]
  if (!name) return
  const confirmed = await confirm(getFriendGroupMemberRemoveCopy(name))
  if (!confirmed) return
  removeMember(index)
}
```

Wire chip ✕: `onClick={() => void removeMemberWithConfirm(index)}`.

- [ ] **Step 3: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

---

## Task 6: Guest claim + payment undo

**Files:**
- Modify: `src/components/bills/participant-breakdown-content.tsx`
- Modify: `src/components/bills/payment-actions.tsx`

- [ ] **Step 1: Confirm guest claim unassign**

In `participant-breakdown-content.tsx`, the remove button calls `onRemoveItem` directly. Wrap at click site:

```tsx
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { getClaimUnassignCopy } from '#/lib/destructive-action-copy.ts'

const { confirm } = useConfirmAction()

async function handleRemoveItemWithConfirm(
  itemId: Id<'items'>,
  label: string,
) {
  const confirmed = await confirm(getClaimUnassignCopy(label))
  if (!confirmed) return
  await onRemoveItem?.(itemId)
}
```

Update button `onClick`:

```tsx
onClick={() =>
  void handleRemoveItemWithConfirm(
    line.itemId as Id<'items'>,
    line.label,
  )
}
```

Only when `removableItemLines && line.kind === 'item' && onRemoveItem`.

- [ ] **Step 2: Confirm payment undo**

In `payment-actions.tsx`:

```tsx
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { getPaymentUndoCopy } from '#/lib/destructive-action-copy.ts'

const { confirm } = useConfirmAction()

async function handleUndoLastWithConfirm() {
  const confirmed = await confirm(getPaymentUndoCopy())
  if (!confirmed) return
  await handleUndoLast()
}
```

Wire button: `onClick={() => void handleUndoLastWithConfirm()}`.

- [ ] **Step 3: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

---

## Task 7: Sign-out confirm

**Files:**
- Modify: `src/components/layout/app-header-menu.tsx`

- [ ] **Step 1: Wire sign-out confirm**

```tsx
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { getSignOutCopy } from '#/lib/destructive-action-copy.ts'

const { confirm } = useConfirmAction()

async function handleSignOutWithConfirm() {
  const confirmed = await confirm(getSignOutCopy())
  if (!confirmed) return
  await handleSignOut()
}
```

Change menu item:

```tsx
<DropdownMenuItem
  variant="destructive"
  onSelect={(e) => {
    e.preventDefault()
    void handleSignOutWithConfirm()
  }}
>
```

- [ ] **Step 2: Run preflight**

Run: `pnpm run preflight`
Expected: PASS

---

## Task 8: Verification + spec exit criteria

- [ ] **Step 1: Grep audit — no unguarded destructive handlers**

Run:

```bash
rg 'removeBill|removeItem|removeParticipant|removeGroup|handleSignOut|handleUndoLast|onRemoveItem' src/components src/routes --glob '*.tsx'
```

Manually verify each call site either goes through `confirm()` or is the inner handler called only after confirm wrapper.

- [ ] **Step 2: Run full test suite**

Run: `pnpm run preflight`
Expected: PASS (219+ tests)

- [ ] **Step 3: Manual QA checklist**

For each action (bill delete ×2, item, participant, friend group, member chip, claim unassign, payment undo, sign-out):

1. Cancel → no mutation, no toast
2. Confirm → existing success behavior unchanged
3. Item/participant confirm → undo toast still works
4. Light + dark mode dialog readable

- [ ] **Step 4: Update spec exit criteria**

In `docs/superpowers/specs/2026-07-09-delete-confirmation-design.md`, mark exit criteria `[x]`.

- [ ] **Step 5: Update plan status**

Set this plan's **Status** to `✅ Complete`.

---

## Self-review (spec coverage)

| Spec requirement | Task |
|------------------|------|
| AlertDialog + confirm provider | Task 2 |
| Centralized copy map | Task 1 |
| Bill delete refactor (×2) | Task 3 |
| Item + participant + undo toasts kept | Task 4 |
| Friend group delete + member chip | Task 5 |
| Guest claim unassign | Task 6 |
| Payment undo | Task 6 |
| Sign-out | Task 7 |
| Unit tests (copy + state) | Tasks 1–2 |
| Manual QA + preflight | Task 8 |
| Receipt replace (#10 optional) | **Out of scope** — keep existing dedicated Dialog |

**Next after completion:** none — feature complete after Task 8.
