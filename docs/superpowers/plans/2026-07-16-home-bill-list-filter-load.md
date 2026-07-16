# Home Bill List Filter + Load-More Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move host home (`/`) bill finding to a paginated `listWithSummary` API with server-side status + search and an explicit «Зареди още» control (chunk size 20).

**Architecture:** Add compound index `by_ownerId_status_updatedAt`. Evolve `bills.listWithSummary` to `paginationOpts` + optional `status` / `search`, driven by `usePaginatedQuery`. Status chip syncs to TanStack Router search (`replace`); search stays local with 300ms debounce. Pure helpers own match rules, URL parse, and empty copy.

**Tech Stack:** Convex (`paginationOptsValidator`, `usePaginatedQuery`), `convex-helpers` server `filter`, TanStack Router, Vitest, React 19

**Spec:** `docs/superpowers/specs/2026-07-16-home-bill-list-filter-load-design.md`

## Global Constraints

- Chunk size **20** for `initialNumItems` and each `loadMore(20)`
- Status chips: **Всички / Чернови / Приключени** → omit / `draft` / `final`
- Status in URL with **replace** history; search **not** in URL
- Search: case-insensitive **contains** on restaurant name **or** `listParticipantNames`; trim; empty = no text filter
- Order: `updatedAt` desc (not FTS / relevance)
- Search debounce: **300ms** (implementation lock)
- Evolve existing `bills.listWithSummary` (drop `limit`); do not add a second list query
- Out of scope: date/amount/sort toggles, collection filter, numbered pages, infinite scroll, FTS, search-in-URL

---

## File map

| File                                | Responsibility                                                        |
| ----------------------------------- | --------------------------------------------------------------------- |
| `convex/lib/billListSearch.ts`      | Normalize search + `billMatchesHomeSearch`                            |
| `convex/lib/billListSearch.test.ts` | Vitest for match rules                                                |
| `src/lib/home-bill-list.ts`         | Page size, debounce ms, status URL parse/serialize, empty-state copy  |
| `src/lib/home-bill-list.test.ts`    | Vitest for URL + empty copy                                           |
| `convex/schema.ts`                  | `by_ownerId_status_updatedAt` index                                   |
| `package.json`                      | Add `convex-helpers`                                                  |
| `convex/bills.ts`                   | Paginated `listWithSummary`                                           |
| `src/routes/index.tsx`              | `validateSearch`, chips, debounced search, paginated list + load more |

---

### Task 1: Pure helpers (search match, URL status, empty copy)

**Files:**

- Create: `convex/lib/billListSearch.ts`
- Create: `convex/lib/billListSearch.test.ts`
- Create: `src/lib/home-bill-list.ts`
- Create: `src/lib/home-bill-list.test.ts`

**Interfaces:**

- Produces:

```ts
// convex/lib/billListSearch.ts
export function normalizeHomeBillSearch(search: string | undefined): string
export function billMatchesHomeSearch(
  bill: { restaurantName: string; listParticipantNames?: string[] },
  normalizedSearch: string, // already normalizeHomeBillSearch'd; "" = match all
): boolean

// src/lib/home-bill-list.ts
export const HOME_BILL_PAGE_SIZE = 20
export const HOME_BILL_SEARCH_DEBOUNCE_MS = 300
export type HomeBillStatusFilter = 'draft' | 'final'
export function parseHomeBillStatusSearch(
  value: unknown,
): HomeBillStatusFilter | undefined
export function homeBillStatusSearchParam(
  status: HomeBillStatusFilter | undefined,
): { status?: HomeBillStatusFilter }
export function homeBillListEmptyMessage(args: {
  status: HomeBillStatusFilter | undefined
  search: string // raw or trimmed; non-empty after trim => search empty copy
}): string
```

- [ ] **Step 1: Write failing tests for search match**

```ts
// convex/lib/billListSearch.test.ts
import { describe, expect, it } from 'vitest'
import {
  billMatchesHomeSearch,
  normalizeHomeBillSearch,
} from './billListSearch'

describe('normalizeHomeBillSearch', () => {
  it('trims and lowercases', () => {
    expect(normalizeHomeBillSearch('  MeZE  ')).toBe('meze')
  })

  it('treats whitespace-only as empty', () => {
    expect(normalizeHomeBillSearch('   ')).toBe('')
    expect(normalizeHomeBillSearch(undefined)).toBe('')
  })
})

describe('billMatchesHomeSearch', () => {
  const bill = {
    restaurantName: 'Meze Bar',
    listParticipantNames: ['Иван', 'Мария'],
  }

  it('matches all when normalized search is empty', () => {
    expect(billMatchesHomeSearch(bill, '')).toBe(true)
  })

  it('matches restaurant contains case-insensitively', () => {
    expect(billMatchesHomeSearch(bill, 'meze')).toBe(true)
  })

  it('matches participant name contains', () => {
    expect(billMatchesHomeSearch(bill, 'мар')).toBe(true)
  })

  it('rejects non-matches', () => {
    expect(billMatchesHomeSearch(bill, 'pizza')).toBe(false)
  })

  it('treats missing participant names as empty list', () => {
    expect(
      billMatchesHomeSearch(
        { restaurantName: 'X', listParticipantNames: undefined },
        'иван',
      ),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run search tests — expect FAIL**

Run: `pnpm exec vitest run convex/lib/billListSearch.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 3: Implement search helpers**

```ts
// convex/lib/billListSearch.ts
export function normalizeHomeBillSearch(search: string | undefined): string {
  return (search ?? '').trim().toLowerCase()
}

export function billMatchesHomeSearch(
  bill: { restaurantName: string; listParticipantNames?: string[] },
  normalizedSearch: string,
): boolean {
  if (!normalizedSearch) return true
  if (bill.restaurantName.toLowerCase().includes(normalizedSearch)) return true
  return (bill.listParticipantNames ?? []).some((name) =>
    name.toLowerCase().includes(normalizedSearch),
  )
}
```

- [ ] **Step 4: Run search tests — expect PASS**

Run: `pnpm exec vitest run convex/lib/billListSearch.test.ts`

Expected: PASS

- [ ] **Step 5: Write failing tests for home list URL + empty copy**

```ts
// src/lib/home-bill-list.test.ts
import { describe, expect, it } from 'vitest'
import {
  HOME_BILL_PAGE_SIZE,
  HOME_BILL_SEARCH_DEBOUNCE_MS,
  homeBillListEmptyMessage,
  homeBillStatusSearchParam,
  parseHomeBillStatusSearch,
} from './home-bill-list.ts'

describe('home bill list constants', () => {
  it('locks page size and debounce from the spec/plan', () => {
    expect(HOME_BILL_PAGE_SIZE).toBe(20)
    expect(HOME_BILL_SEARCH_DEBOUNCE_MS).toBe(300)
  })
})

describe('parseHomeBillStatusSearch', () => {
  it('accepts draft and final', () => {
    expect(parseHomeBillStatusSearch('draft')).toBe('draft')
    expect(parseHomeBillStatusSearch('final')).toBe('final')
  })

  it('treats missing/invalid as all (undefined)', () => {
    expect(parseHomeBillStatusSearch(undefined)).toBeUndefined()
    expect(parseHomeBillStatusSearch('')).toBeUndefined()
    expect(parseHomeBillStatusSearch('all')).toBeUndefined()
    expect(parseHomeBillStatusSearch(1)).toBeUndefined()
  })
})

describe('homeBillStatusSearchParam', () => {
  it('omits status for all', () => {
    expect(homeBillStatusSearchParam(undefined)).toEqual({})
  })

  it('includes status for chips', () => {
    expect(homeBillStatusSearchParam('draft')).toEqual({ status: 'draft' })
  })
})

describe('homeBillListEmptyMessage', () => {
  it('no bills at all', () => {
    expect(homeBillListEmptyMessage({ status: undefined, search: '' })).toBe(
      'Все още нямате сметки. Създайте първата си сметка!',
    )
  })

  it('search miss wins over status', () => {
    expect(homeBillListEmptyMessage({ status: 'draft', search: 'xyz' })).toBe(
      'Няма намерени сметки.',
    )
  })

  it('status-only empties', () => {
    expect(homeBillListEmptyMessage({ status: 'draft', search: '  ' })).toBe(
      'Няма чернови.',
    )
    expect(homeBillListEmptyMessage({ status: 'final', search: '' })).toBe(
      'Няма приключени.',
    )
  })
})
```

- [ ] **Step 6: Run home-list helper tests — expect FAIL**

Run: `pnpm exec vitest run src/lib/home-bill-list.test.ts`

Expected: FAIL (module not found)

- [ ] **Step 7: Implement home-list helpers**

```ts
// src/lib/home-bill-list.ts
export const HOME_BILL_PAGE_SIZE = 20
export const HOME_BILL_SEARCH_DEBOUNCE_MS = 300

export type HomeBillStatusFilter = 'draft' | 'final'

export function parseHomeBillStatusSearch(
  value: unknown,
): HomeBillStatusFilter | undefined {
  if (value === 'draft' || value === 'final') return value
  return undefined
}

export function homeBillStatusSearchParam(
  status: HomeBillStatusFilter | undefined,
): { status?: HomeBillStatusFilter } {
  return status ? { status } : {}
}

export function homeBillListEmptyMessage(args: {
  status: HomeBillStatusFilter | undefined
  search: string
}): string {
  if (args.search.trim()) return 'Няма намерени сметки.'
  if (args.status === 'draft') return 'Няма чернови.'
  if (args.status === 'final') return 'Няма приключени.'
  return 'Все още нямате сметки. Създайте първата си сметка!'
}
```

- [ ] **Step 8: Run home-list helper tests — expect PASS**

Run: `pnpm exec vitest run src/lib/home-bill-list.test.ts`

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add convex/lib/billListSearch.ts convex/lib/billListSearch.test.ts \
  src/lib/home-bill-list.ts src/lib/home-bill-list.test.ts
git commit -m "$(cat <<'EOF'
Add home bill list search and filter helpers.

Pure match/URL/empty-copy helpers unlock paginated listWithSummary TDD.
EOF
)"
```

---

### Task 2: Schema index + paginated `listWithSummary`

**Files:**

- Modify: `package.json` / lockfile (via pnpm)
- Modify: `convex/schema.ts` (bills indexes)
- Modify: `convex/bills.ts` (`listWithSummary`)

**Interfaces:**

- Consumes: `normalizeHomeBillSearch`, `billMatchesHomeSearch` from `./lib/billListSearch`
- Produces: `bills.listWithSummary` args/result:

```ts
args: {
  paginationOpts: paginationOptsValidator,
  status: v.optional(v.union(v.literal('draft'), v.literal('final'))),
  search: v.optional(v.string()),
}
// returns PaginationResult of:
{
  bill: Doc<'bills'>,
  participantNames: string[],
  billTotalCents: number,
  totalOutstandingCents: number | null,
}
```

- [ ] **Step 1: Install convex-helpers**

```bash
pnpm add convex-helpers
```

Expected: `convex-helpers` in `package.json` dependencies.

- [ ] **Step 2: Add compound index**

In `convex/schema.ts` on `bills`, next to existing indexes:

```ts
.index('by_ownerId_updatedAt', ['ownerId', 'updatedAt'])
.index('by_ownerId_status_updatedAt', ['ownerId', 'status', 'updatedAt'])
.index('by_shareToken', ['shareToken']),
```

- [ ] **Step 3: Replace `listWithSummary` with paginated query**

Replace the current `listWithSummary` in `convex/bills.ts`:

```ts
import { paginationOptsValidator } from 'convex/server'
import { filter } from 'convex-helpers/server/filter'
import {
  billMatchesHomeSearch,
  normalizeHomeBillSearch,
} from './lib/billListSearch'

export const listWithSummary = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.union(v.literal('draft'), v.literal('final'))),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx)
    const normalizedSearch = normalizeHomeBillSearch(args.search)

    const ordered =
      args.status === undefined
        ? ctx.db
            .query('bills')
            .withIndex('by_ownerId_updatedAt', (q) => q.eq('ownerId', userId))
            .order('desc')
        : ctx.db
            .query('bills')
            .withIndex('by_ownerId_status_updatedAt', (q) =>
              q.eq('ownerId', userId).eq('status', args.status!),
            )
            .order('desc')

    const filtered = normalizedSearch
      ? filter(ordered, (bill) => billMatchesHomeSearch(bill, normalizedSearch))
      : ordered

    const result = await filtered.paginate(args.paginationOpts)

    return {
      ...result,
      page: result.page.map((bill) => ({
        bill,
        participantNames: bill.listParticipantNames ?? [],
        billTotalCents: bill.listBillTotalCents ?? 0,
        totalOutstandingCents:
          bill.status === 'draft' ? null : (bill.listOutstandingCents ?? 0),
      })),
    }
  },
})
```

Notes for the implementer:

- Do **not** keep the old `limit` arg — home is the only caller.
- `filter` from `convex-helpers` applies the predicate while scanning so pagination stays cursor-correct (pages may still underfill when search is sparse; «Зареди още» continues — acceptable at tens–low hundreds).
- After schema change, ensure `npx convex dev` / codegen has run in the environment before typechecking client against new args.

- [ ] **Step 4: Typecheck Convex module**

```bash
pnpm exec tsc --noEmit -p . 2>&1 | rg "bills\.ts|billListSearch|home-bill-list" || true
```

Expected: errors only from `src/routes/index.tsx` still calling the old `listWithSummary` shape (fixed in Task 3), not from the new query definition itself.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml convex/schema.ts convex/bills.ts
git commit -m "$(cat <<'EOF'
Paginate listWithSummary with status and search filters.

Adds owner/status/updatedAt index and convex-helpers filter for contains match.
EOF
)"
```

---

### Task 3: Home route — URL chips, debounced search, load more

**Files:**

- Modify: `src/routes/index.tsx`

**Interfaces:**

- Consumes: `HOME_BILL_PAGE_SIZE`, `HOME_BILL_SEARCH_DEBOUNCE_MS`, `parseHomeBillStatusSearch`, `homeBillStatusSearchParam`, `homeBillListEmptyMessage` from `#/lib/home-bill-list.ts`
- Consumes: `usePaginatedQuery` from `convex/react`; `api.bills.listWithSummary`
- Produces: `/` search `{ status?: 'draft' | 'final' }`

- [ ] **Step 1: Add `validateSearch` on the home route**

```tsx
import {
  HOME_BILL_PAGE_SIZE,
  HOME_BILL_SEARCH_DEBOUNCE_MS,
  homeBillListEmptyMessage,
  homeBillStatusSearchParam,
  parseHomeBillStatusSearch,
  type HomeBillStatusFilter,
} from '#/lib/home-bill-list.ts'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    status: parseHomeBillStatusSearch(search.status),
  }),
  head: () => buildHomeHead(),
  component: Home,
})
```

Regenerate route types if your workflow requires it:

```bash
pnpm run generate-routes
```

- [ ] **Step 2: Wire paginated query + debounced search + chips + load more**

Replace the list data path inside `Home` (keep create-bill, payment banner, auth gate). Essential shape:

```tsx
import { usePaginatedQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { Loader2Icon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'

function Home() {
  const navigate = useNavigate()
  const { status: statusFilter } = Route.useSearch()
  const { isAuthenticated, isLoading } = useRequireHostAuth('/')

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [listEpoch, setListEpoch] = useState(0)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, HOME_BILL_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [search])

  const listArgs = isAuthenticated
    ? {
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }
    : 'skip'

  const { results, status, loadMore } = usePaginatedQuery(
    api.bills.listWithSummary,
    listArgs,
    { initialNumItems: HOME_BILL_PAGE_SIZE },
  )

  // key={listEpoch} on the list section so Retry remounts the query after errors
  // ...

  function selectStatus(next: HomeBillStatusFilter | undefined) {
    void navigate({
      to: '/',
      search: homeBillStatusSearchParam(next),
      replace: true,
    })
  }

  // Auth loading UI unchanged...

  return (
    <div className="page-container">
      {/* PwaInstallBanner + payment banner + Нова сметка unchanged */}

      {/* Search input — same id/placeholder; value={search} onChange */}

      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Филтър по статус"
      >
        {(
          [
            { value: undefined, label: 'Всички' },
            { value: 'draft' as const, label: 'Чернови' },
            { value: 'final' as const, label: 'Приключени' },
          ] as const
        ).map((chip) => {
          const selected = statusFilter === chip.value
          return (
            <Button
              key={chip.label}
              type="button"
              size="sm"
              variant={selected ? 'default' : 'outline'}
              className="h-9 px-3"
              aria-pressed={selected}
              onClick={() => selectStatus(chip.value)}
            >
              {chip.label}
            </Button>
          )
        })}
      </div>

      <div key={listEpoch} className="flex flex-col gap-3">
        {status === 'LoadingFirstPage' &&
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}

        {status !== 'LoadingFirstPage' && results.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            {homeBillListEmptyMessage({
              status: statusFilter,
              search: debouncedSearch,
            })}
          </p>
        )}

        {results.map((summary) => (
          <BillCard key={summary.bill._id} {...summary} />
        ))}

        {status === 'CanLoadMore' && (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() => loadMore(HOME_BILL_PAGE_SIZE)}
          >
            Зареди още
          </Button>
        )}

        {status === 'LoadingMore' && (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            disabled
          >
            <Loader2Icon className={cn(ICON.button, 'animate-spin')} />
            Зареди още
          </Button>
        )}
      </div>
    </div>
  )
}
```

Implementer details:

- Import `ICON` from the same place other buttons use (e.g. `#/lib/icon-size.ts` or whatever `assignment-row` uses) — match existing spinner sizing; if no shared `ICON`, use `className="size-4 animate-spin"`.
- Remove `useMemo` client filter and `useQuery(listWithSummary)`.
- Chips + search stay mounted during `LoadingFirstPage` (skeletons only in the list region).
- **Error UX (minimal):** wrap the keyed list region in a small class error boundary (or reuse a tiny local one) that renders „Неуспешно зареждане.“ + button „Опитай отново“ calling `setListEpoch((n) => n + 1)`. For later-page cursor errors Convex resets to first page — skeletons are enough; optional `toast.error` inside `componentDidCatch`.
- Do not put `search` into the router.

- [ ] **Step 3: Typecheck + unit tests**

```bash
pnpm exec vitest run convex/lib/billListSearch.test.ts src/lib/home-bill-list.test.ts
pnpm exec tsc --noEmit -p . 2>&1 | rg "index\.tsx|listWithSummary|home-bill-list" || true
```

Expected: helper tests PASS; no type errors on the home route / `listWithSummary` args.

- [ ] **Step 4: Manual browser check**

Run: `pnpm dev` (with Convex running)

Checklist:

1. `/` loads ≤20 bills; «Зареди още» appears when more exist and appends without replacing the list.
2. Chip **Чернови** → URL `?status=draft` (replace); **Всички** clears param.
3. Search filters server-side after ~300ms; empty/whitespace clears text filter.
4. Empty copies: no bills / search miss / no drafts / no finals.
5. Open a bill and Back → status chip restored; search box empty.
6. Chip changes show first-page skeletons; controls stay clickable.

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx
# include generated route tree files if generate-routes changed them
git commit -m "$(cat <<'EOF'
Wire home bill list to paginated filters and load more.

Status chips sync to the URL; search stays local with debounce.
EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement                                             | Task                      |
| ------------------------------------------------------------ | ------------------------- |
| Paginated `listWithSummary` + drop `limit`                   | Task 2                    |
| `status?` + `search?` args; summary DTO                      | Task 2                    |
| `by_ownerId_status_updatedAt` + keep owner/updatedAt         | Task 2                    |
| Contains match restaurant \| participants; empty = no filter | Task 1 + 2                |
| Chunk size 20 + «Зареди още»                                 | Task 1 constants + Task 3 |
| Status URL replace; search local                             | Task 1 + 3                |
| Empty / loading / load-more / error UX                       | Task 1 copy + Task 3      |
| Debounce locked                                              | Task 1 (`300`) + Task 3   |
| Out of scope items not built                                 | —                         |

No placeholders remain; helper and query signatures are consistent across tasks.
