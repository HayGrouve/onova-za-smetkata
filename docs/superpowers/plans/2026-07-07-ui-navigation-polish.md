# UI Navigation & Interaction Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sticky top navigation with back/title per route and consistent subtle interaction polish (pointer cursor, tap feedback) across the app.

**Architecture:** Root route wraps all pages in `AppShell` + route-aware `AppHeader`. Global CSS utilities plus targeted class updates on interactive components. No backend changes.

**Tech Stack:** TanStack Router (`Outlet`, `Link`, `useRouterState`), React, Convex `useQuery`, Tailwind, Shadcn Button

**Spec:** `docs/superpowers/specs/2026-07-07-ui-navigation-polish-design.md`

---

## File Map

| File                                            | Responsibility                          |
| ----------------------------------------------- | --------------------------------------- |
| `src/components/layout/app-shell.tsx`           | Page wrapper + main padding             |
| `src/components/layout/app-header.tsx`          | Sticky nav, back, title                 |
| `src/routes/__root.tsx`                         | Wire `AppShell` + `Outlet`              |
| `src/styles.css`                                | `tap-feedback`, cursor base rules       |
| `src/components/ui/button.tsx`                  | `cursor-pointer` on buttons             |
| `src/routes/index.tsx`                          | Remove duplicate h1; adjust padding     |
| `src/routes/bills/$billId/index.tsx`            | Remove duplicate h1; adjust padding     |
| `src/routes/bills/$billId/summary.tsx`          | Remove duplicate title block; keep date |
| `src/components/bills/bill-card.tsx`            | tap-feedback classes                    |
| `src/components/bills/sticky-totals-bar.tsx`    | pointer + tap on tap areas              |
| `src/components/bills/payment-row.tsx`          | pointer on header button                |
| `src/components/bills/receipt-preview-card.tsx` | tap-feedback on thumbnail               |
| `src/routes/bills/$billId/index.tsx`            | receipt upload button polish            |

---

### Task 1: Global interaction CSS

**Files:**

- Modify: `src/styles.css`
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Add utilities to `styles.css`**

After existing `@layer base` block, add:

```css
@layer utilities {
  .tap-feedback {
    transition:
      transform 150ms ease,
      opacity 150ms ease,
      background-color 150ms ease,
      border-color 150ms ease;
  }

  .tap-feedback:active:not(:disabled):not([aria-disabled='true']) {
    transform: scale(0.98);
    opacity: 0.92;
  }

  .interactive-hover:hover {
    border-color: color-mix(in oklab, var(--border) 70%, var(--foreground) 30%);
  }
}

@layer base {
  button:not(:disabled),
  a[href],
  [role='button']:not([aria-disabled='true']),
  [data-interactive='true']:not([data-disabled='true']) {
    cursor: pointer;
  }

  button:disabled,
  [aria-disabled='true'] {
    cursor: not-allowed;
  }
}
```

- [ ] **Step 2: Add `cursor-pointer` to button cva base string in `button.tsx`**

Add `cursor-pointer disabled:cursor-not-allowed` to the cva first argument.

- [ ] **Step 3: Run tests**

Run: `npm test -- --run`

- [ ] **Step 4: Commit**

```bash
git add src/styles.css src/components/ui/button.tsx
git commit -m "$(cat <<'EOF'
Add global tap-feedback utilities and pointer cursor rules.

EOF
)"
```

---

### Task 2: AppShell and AppHeader

**Files:**

- Create: `src/components/layout/app-header.tsx`
- Create: `src/components/layout/app-shell.tsx`

- [ ] **Step 1: Create `app-header.tsx`**

```typescript
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronLeftIcon } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

function useHeaderConfig() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const params = useParams({ strict: false })
  const billId = params.billId as Id<'bills'> | undefined

  const billData = useQuery(
    api.bills.get,
    billId ? { billId } : 'skip',
  )

  const isHome = pathname === '/'
  const isSummary = pathname.endsWith('/summary')
  const isEditor = billId !== undefined && !isSummary

  const restaurantName =
    billData?.bill.restaurantName.trim() || 'Без име'

  if (isHome) {
    return {
      title: 'Онова за сметката',
      backTo: null as string | null,
      backParams: undefined as Record<string, string> | undefined,
    }
  }

  if (isSummary && billId) {
    return {
      title: billData === undefined ? 'Зареждане…' : restaurantName,
      backTo: '/bills/$billId' as const,
      backParams: { billId },
    }
  }

  if (isEditor && billId) {
    return {
      title: billData === undefined ? 'Зареждане…' : restaurantName,
      backTo: '/' as const,
      backParams: undefined,
    }
  }

  return { title: 'Онова за сметката', backTo: null, backParams: undefined }
}

export function AppHeader() {
  const { title, backTo, backParams } = useHeaderConfig()

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-2">
        {backTo ? (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 tap-feedback"
            aria-label="Назад"
            asChild
          >
            <Link to={backTo} params={backParams}>
              <ChevronLeftIcon className="size-5" />
            </Link>
          </Button>
        ) : (
          <div className="size-9 shrink-0" aria-hidden />
        )}
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
          {title}
        </h1>
        <div className="size-9 shrink-0" aria-hidden />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Create `app-shell.tsx`**

```typescript
import { AppHeader } from '#/components/layout/app-header.tsx'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-header.tsx src/components/layout/app-shell.tsx
git commit -m "$(cat <<'EOF'
Add AppShell and route-aware AppHeader navigation.

EOF
)"
```

---

### Task 3: Wire root layout

**Files:**

- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Add root component with Outlet**

```typescript
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { AppShell } from '../components/layout/app-shell.tsx'

// ... existing head config ...

function RootLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

export const Route = createRootRoute({
  head: () => ({ /* existing */ }),
  shellComponent: RootDocument,
  component: RootLayout,
})
```

- [ ] **Step 2: Verify dev server compiles** (no test changes expected)

- [ ] **Step 3: Commit**

```bash
git add src/routes/__root.tsx
git commit -m "$(cat <<'EOF'
Wrap all routes in AppShell via root layout.

EOF
)"
```

---

### Task 4: Clean up page layouts

**Files:**

- Modify: `src/routes/index.tsx`
- Modify: `src/routes/bills/$billId/index.tsx`
- Modify: `src/routes/bills/$billId/summary.tsx`

- [ ] **Step 1: Home — remove header h1**

Remove:

```tsx
<header className="mb-5 flex items-center justify-between gap-3">
  <h1 className="text-2xl font-bold">Онова за сметката</h1>
</header>
```

Change outer div to `className="mx-auto max-w-lg px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"` (drop pt-6 since AppHeader handles top).

- [ ] **Step 2: Editor — remove h1 „Редактиране на сметка“**

Change wrapper from `pt-6 pb-32` to `pt-4 pb-32`.

Add `tap-feedback cursor-pointer` to receipt upload dashed button.

- [ ] **Step 3: Summary — simplify top block**

Remove the `<h1>` restaurant name from the top flex block. Keep date + draft badge in a compact row:

```tsx
<div className="mb-4 flex items-center justify-between gap-3">
  <p className="text-sm text-muted-foreground">
    {dateFormatter.format(new Date(bill.date))}
  </p>
  {isDraft ? (
    <Badge variant="secondary">Чернова</Badge>
  ) : (
    <Badge>Завършена</Badge>
  )}
</div>
```

Adjust padding `py-6` → `pt-4 py-6`.

- [ ] **Step 4: Run tests**

Run: `npm test -- --run`

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx src/routes/bills/\$billId/index.tsx src/routes/bills/\$billId/summary.tsx
git commit -m "$(cat <<'EOF'
Remove duplicate page titles now shown in AppHeader.

EOF
)"
```

---

### Task 5: Component interaction audit

**Files:**

- Modify: `src/components/bills/bill-card.tsx`
- Modify: `src/components/bills/sticky-totals-bar.tsx`
- Modify: `src/components/bills/payment-row.tsx`
- Modify: `src/components/bills/receipt-preview-card.tsx`

- [ ] **Step 1: BillCard**

```tsx
<Link
  to={to}
  params={{ billId: bill._id }}
  className="block tap-feedback"
  data-interactive="true"
>
  <Card className="gap-3 py-4 transition-colors interactive-hover active:bg-accent">
```

- [ ] **Step 2: StickyTotalsBar**

Add `tap-feedback cursor-pointer` to:

- The expand totals `<button>`
- The „Преглед“ `<Link>` (add className)

- [ ] **Step 3: PaymentRow**

Add `tap-feedback` to the header `<button>` when `onOpenDetail` is set.

- [ ] **Step 4: ReceiptPreviewCard**

Add `tap-feedback data-interactive="true"` to thumbnail button.

- [ ] **Step 5: Run tests + commit**

```bash
npm test -- --run
git add src/components/bills/bill-card.tsx src/components/bills/sticky-totals-bar.tsx src/components/bills/payment-row.tsx src/components/bills/receipt-preview-card.tsx
git commit -m "$(cat <<'EOF'
Apply tap-feedback and pointer polish to interactive bill components.

EOF
)"
```

---

### Task 6: Manual verification

- [ ] **Step 1: Smoke test checklist**

1. `/` — header shows app title, no back button
2. Create/open bill — header shows restaurant name, back → home
3. Summary — back → editor, title unchanged
4. Desktop hover — pointer on cards, buttons, tappable rows
5. Tap/click — subtle scale feedback on buttons and cards

- [ ] **Step 2: Fix any layout overlap** (editor sticky bar vs header z-index — header z-50, sticky bar z-40 is correct)

---

### Task 7: Commit docs

- [ ] **Step 1: Commit spec + plan** (if not already committed)

```bash
git add docs/superpowers/specs/2026-07-07-ui-navigation-polish-design.md docs/superpowers/plans/2026-07-07-ui-navigation-polish.md
git commit -m "$(cat <<'EOF'
Add spec and plan for UI navigation and interaction polish.

EOF
)"
```
