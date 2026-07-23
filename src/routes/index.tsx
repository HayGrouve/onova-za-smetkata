import { Component, useEffect, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, usePaginatedQuery } from 'convex/react'
import { toast } from 'sonner'
import { Loader2Icon, PlusIcon, SearchIcon } from 'lucide-react'
import { BillCard } from '#/components/bills/bill-card.tsx'
import {
  PaymentSettingsOpenButton,
  usePaymentSettingsStatus,
} from '#/components/bills/payment-settings-open-button.tsx'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { QueryErrorPanel } from '#/components/ui/query-error-panel.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { PwaInstallBanner } from '#/components/pwa-install-banner.tsx'
import { ICON } from '#/lib/app-icons.ts'
import {
  HOME_BILL_PAGE_SIZE,
  HOME_BILL_SEARCH_DEBOUNCE_MS,
  homeBillListEmptyMessage,
  homeBillStatusSearchParam,
  parseHomeBillStatusSearch,
} from '#/lib/home-bill-list.ts'
import type { HomeBillStatusFilter } from '#/lib/home-bill-list.ts'
import { buildHomeHead } from '#/lib/site-meta.ts'
import { cn } from '#/lib/utils.ts'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => ({
    status: parseHomeBillStatusSearch(search.status),
  }),
  head: () => buildHomeHead(),
  component: Home,
})

const STATUS_CHIPS = [
  { value: undefined, label: 'Всички' },
  { value: 'draft' as const, label: 'Чернови' },
  { value: 'final' as const, label: 'Приключени' },
] as const

class HomeBillListErrorBoundary extends Component<
  {
    resetKey: number
    onRetry: () => void
    children: ReactNode
  },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Home bill list failed', error, info)
    toast.error('Неуспешно зареждане на сметките')
  }

  componentDidUpdate(prevProps: { resetKey: number }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <QueryErrorPanel
          message="Неуспешно зареждане."
          onRetry={this.props.onRetry}
        />
      )
    }
    return this.props.children
  }
}

function Home() {
  const navigate = useNavigate()
  const { status: statusFilter } = Route.useSearch()
  const { isAuthenticated, isLoading } = useRequireHostAuth('/')
  const createBill = useMutation(api.bills.create)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [listResetKey, setListResetKey] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const paymentSettingsStatus = usePaymentSettingsStatus()
  const { openPaymentSettings } = usePaymentSettingsSheet()

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

  if (isLoading || !isAuthenticated) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  async function handleCreateBill() {
    setIsCreating(true)
    try {
      const billId = await createBill()
      await navigate({
        to: '/bills/$billId',
        params: { billId },
        search: { step: 1 },
      })
    } catch {
      toast.error('Неуспешно създаване на сметка')
    } finally {
      setIsCreating(false)
    }
  }

  function selectStatus(next: HomeBillStatusFilter | undefined) {
    void navigate({
      to: '/',
      search: homeBillStatusSearchParam(next),
      replace: true,
    })
  }

  const showFirstPageSkeletons = status === 'LoadingFirstPage'

  return (
    <div className="page-container">
      <PwaInstallBanner />
      {paymentSettingsStatus === 'unconfigured' ? (
        <div className="mb-2">
          <PaymentSettingsOpenButton onClick={openPaymentSettings} />
        </div>
      ) : null}

      <Button
        className="mb-4 h-11 w-full"
        onClick={handleCreateBill}
        disabled={isCreating}
      >
        <PlusIcon /> Нова сметка
      </Button>

      <div className="relative mb-4">
        <Label htmlFor="home-bill-search" className="sr-only">
          Търсене по ресторант или участник
        </Label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="home-bill-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Търсене по ресторант или участник"
          className="h-11 pl-9"
        />
      </div>

      <div
        className="mb-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Филтър по статус"
      >
        {STATUS_CHIPS.map((chip) => {
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

      <HomeBillListErrorBoundary
        resetKey={listResetKey}
        onRetry={() => setListResetKey((n) => n + 1)}
      >
        <div key={listResetKey} className="flex flex-col gap-3">
          {showFirstPageSkeletons &&
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}

          {!showFirstPageSkeletons && results.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              {homeBillListEmptyMessage({
                status: statusFilter,
                search: debouncedSearch,
              })}
            </p>
          )}

          {!showFirstPageSkeletons &&
            results.map((summary) => (
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
              <Loader2Icon
                className={cn(
                  ICON.button,
                  'animate-spin motion-reduce:animate-none',
                )}
              />
              Зареди още
            </Button>
          )}
        </div>
      </HomeBillListErrorBoundary>
    </div>
  )
}
