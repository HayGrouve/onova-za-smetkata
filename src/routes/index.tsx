import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { BillCard } from '#/components/bills/bill-card.tsx'
import {
  PaymentSettingsOpenButton,
  usePaymentSettingsStatus,
} from '#/components/bills/payment-settings-open-button.tsx'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { PwaInstallBanner } from '#/components/pwa-install-banner.tsx'
import { buildHomeHead } from '#/lib/site-meta.ts'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/')({
  head: () => buildHomeHead(),
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useRequireHostAuth('/')
  const bills = useQuery(
    api.bills.listWithSummary,
    isAuthenticated ? {} : 'skip',
  )
  const createBill = useMutation(api.bills.create)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const paymentSettingsStatus = usePaymentSettingsStatus()
  const { openPaymentSettings } = usePaymentSettingsSheet()

  const filteredBills = useMemo(() => {
    if (!bills) return null
    const query = search.trim().toLowerCase()
    if (!query) return bills
    return bills.filter(({ bill, participantNames }) => {
      if (bill.restaurantName.toLowerCase().includes(query)) return true
      return participantNames.some((name) => name.toLowerCase().includes(query))
    })
  }, [bills, search])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  const billsLoading = bills === undefined

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

      <div className="flex flex-col gap-3">
        {billsLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full rounded-xl" />
          ))}
        {!billsLoading &&
          filteredBills !== null &&
          filteredBills.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              {search
                ? 'Няма намерени сметки.'
                : 'Все още нямате сметки. Създайте първата си сметка!'}
            </p>
          )}
        {!billsLoading &&
          filteredBills?.map((summary) => (
            <BillCard key={summary.bill._id} {...summary} />
          ))}
      </div>
    </div>
  )
}
