import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { PlusIcon, SearchIcon } from 'lucide-react'
import { BillCard } from '#/components/bills/bill-card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const navigate = useNavigate()
  const bills = useQuery(api.bills.listWithSummary)
  const createBill = useMutation(api.bills.create)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const filteredBills = useMemo(() => {
    if (!bills) return null
    const query = search.trim().toLowerCase()
    if (!query) return bills
    return bills.filter(({ bill, participantNames }) => {
      if (bill.restaurantName.toLowerCase().includes(query)) return true
      return participantNames.some((name) => name.toLowerCase().includes(query))
    })
  }, [bills, search])

  async function handleCreateBill() {
    setIsCreating(true)
    try {
      const billId = await createBill()
      await navigate({ to: '/bills/$billId', params: { billId } })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Онова за сметката</h1>
      </header>

      <Button
        className="mb-4 h-11 w-full"
        onClick={handleCreateBill}
        disabled={isCreating}
      >
        <PlusIcon /> Нова сметка
      </Button>

      <div className="relative mb-4">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Търсене по ресторант или участник"
          className="h-11 pl-9"
        />
      </div>

      <div className="flex flex-col gap-3">
        {filteredBills === null && (
          <p className="py-8 text-center text-muted-foreground">Зареждане...</p>
        )}
        {filteredBills !== null && filteredBills.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            {search
              ? 'Няма намерени сметки.'
              : 'Все още нямате сметки. Създайте първата си сметка!'}
          </p>
        )}
        {filteredBills?.map((summary) => (
          <BillCard key={summary.bill._id} {...summary} />
        ))}
      </div>
    </div>
  )
}
