import { usePaginatedQuery } from 'convex/react'
import { Loader2Icon, SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BillCard } from '#/components/bills/bill-card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import { ICON } from '#/lib/app-icons.ts'
import {
  HOME_BILL_PAGE_SIZE,
  HOME_BILL_SEARCH_DEBOUNCE_MS,
  homeBillListEmptyMessage,
} from '#/lib/home-bill-list.ts'
import { cn } from '#/lib/utils.ts'
import { api } from '../../../convex/_generated/api'

/** „Всички сметки“: searchable archive of every bill, newest first. */
export function BillHistory() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, HOME_BILL_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [search])

  const { results, status, loadMore } = usePaginatedQuery(
    api.bills.listWithSummary,
    debouncedSearch ? { search: debouncedSearch } : {},
    { initialNumItems: HOME_BILL_PAGE_SIZE },
  )

  return (
    <section
      aria-labelledby="home-history-title"
      className="flex flex-col gap-3"
    >
      <h2 id="home-history-title" className="text-[15px] font-bold">
        Предишни бележки
      </h2>
      <div className="relative">
        <Label htmlFor="home-bill-search" className="sr-only">
          Търсене по ресторант или участник
        </Label>
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-0.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="home-bill-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Търсене по ресторант или участник"
          className="pl-7"
        />
      </div>

      {status === 'LoadingFirstPage' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-on-table-muted">
          {homeBillListEmptyMessage({ search: debouncedSearch })}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:gap-5">
          {results.map((summary, index) => (
            <li key={summary.bill._id} className="list-none">
              <BillCard {...summary} tilt={index % 2 === 0 ? -0.8 : 0.7} />
            </li>
          ))}
        </ul>
      )}

      {status === 'CanLoadMore' || status === 'LoadingMore' ? (
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={status === 'LoadingMore'}
          onClick={() => loadMore(HOME_BILL_PAGE_SIZE)}
        >
          {status === 'LoadingMore' ? (
            <Loader2Icon
              className={cn(
                ICON.button,
                'animate-spin motion-reduce:animate-none',
              )}
              aria-hidden
            />
          ) : null}
          Зареди още
        </Button>
      ) : null}
    </section>
  )
}
