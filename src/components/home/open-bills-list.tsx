import { Link } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { ArrowRightIcon } from 'lucide-react'
import { Badge } from '#/components/ui/badge.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { cn } from '#/lib/utils.ts'
import type { api } from '../../../convex/_generated/api'

type OpenBill = FunctionReturnType<
  typeof api.bills.homeOverview
>['openBills'][number]
type OpenBillAction = OpenBill['nextAction']

const shortDate = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'short',
})

/** Quickest wins first: bills ready to close, then collecting, then drafts. */
const GROUPS: ReadonlyArray<{
  action: OpenBillAction
  title: string
  cta: string
}> = [
  { action: 'close', title: 'Готови за приключване', cta: 'Приключи' },
  { action: 'collect', title: 'Чакат плащания', cta: 'Плащания' },
  { action: 'finish', title: 'Довършете', cta: 'Продължи' },
]

export interface OpenBillsListProps {
  bills: OpenBill[]
  truncated: boolean
}

/** „Нужно е действие“: draft bills grouped by the Host's next step. */
export function OpenBillsList({ bills, truncated }: OpenBillsListProps) {
  if (bills.length === 0) return null

  return (
    <section aria-labelledby="home-open-title" className="flex flex-col gap-3">
      <h2 id="home-open-title" className="text-base font-semibold">
        Нужно е действие
      </h2>
      {GROUPS.map((group) => {
        const groupBills = bills.filter(
          (bill) => bill.nextAction === group.action,
        )
        if (groupBills.length === 0) return null
        return (
          <div key={group.action} className="flex flex-col gap-1.5">
            <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {group.title}
            </h3>
            <ul className="flex flex-col gap-2">
              {groupBills.map((bill) => (
                <li key={bill.billId}>
                  <OpenBillRow bill={bill} cta={group.cta} />
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {truncated ? (
        <p className="text-xs text-muted-foreground">
          Показани са последните 50 чернови. По-старите намерете чрез търсене
          по-долу.
        </p>
      ) : null}
    </section>
  )
}

function OpenBillRow({ bill, cta }: { bill: OpenBill; cta: string }) {
  const step = bill.nextAction === 'finish' ? bill.firstIncompleteStep : 4
  const name = bill.restaurantName.trim() || 'Без име'

  return (
    <Link
      to="/bills/$billId"
      params={{ billId: bill.billId }}
      search={{ step }}
      className={cn(
        'tap-feedback flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted/40',
        bill.nextAction === 'close' && 'border-success/40',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-semibold">{name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {shortDate.format(new Date(bill.date))}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {bill.nextAction === 'finish' ? (
            <span>{bill.missing ?? 'Проверете сметката'}</span>
          ) : (
            <>
              {bill.owingGuestCount > 0 ? (
                <Badge variant="secondary" className="font-normal">
                  {bill.paidGuestCount} от {bill.owingGuestCount} платили
                </Badge>
              ) : null}
              {bill.nextAction === 'collect' ? (
                <span>
                  Остават{' '}
                  <span className="money font-medium text-foreground">
                    {formatEur(bill.outstandingCents)}
                  </span>
                </span>
              ) : (
                <span className="text-success">Всички са платили</span>
              )}
            </>
          )}
        </div>
      </div>
      <span
        className={cn(
          'flex shrink-0 items-center gap-1 text-sm font-medium',
          bill.nextAction === 'close' ? 'text-success' : 'text-primary',
        )}
      >
        {cta}
        <ArrowRightIcon className={ICON.button} aria-hidden />
      </span>
    </Link>
  )
}
