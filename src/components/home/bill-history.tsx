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
      <h2 id="home-history-title" className="text-base font-semibold">
        Всички сметки
      </h2>
      <div className="relative">
        <Label htmlFor="home-bill-search" className="sr-only">
          Търсене по ресторант или участник
        </Label>
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="home-bill-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Търсене по ресторант или участник"
          className="h-11 pl-9"
        />
      </div>

      {status === 'LoadingFirstPage' ? (
        Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))
      ) : results.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {homeBillListEmptyMessage({ search: debouncedSearch })}
        </p>
      ) : (
        results.map((summary) => (
          <BillCard key={summary.bill._id} {...summary} />
        ))
      )}

      {status === 'CanLoadMore' || status === 'LoadingMore' ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
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
