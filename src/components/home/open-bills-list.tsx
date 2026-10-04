import { Link } from '@tanstack/react-router'
import type { FunctionReturnType } from 'convex/server'
import { ArrowRightIcon } from 'lucide-react'
import { formatEur } from '#/lib/format-currency.ts'
import type { api } from '../../../convex/_generated/api'

type OpenBill = FunctionReturnType<
  typeof api.bills.homeOverview
>['openBills'][number]
type OpenBillAction = OpenBill['nextAction']

const shortDate = new Intl.DateTimeFormat('bg-BG', {
  day: '2-digit',
  month: 'short',
  timeZone: 'Europe/Sofia',
})

/** Quickest wins first: bills ready to close, then collecting, then drafts. */
const ORDER: Record<OpenBillAction, number> = {
  close: 0,
  collect: 1,
  finish: 2,
}

const PHASE: Record<OpenBillAction, string> = {
  finish: 'Сглобяване',
  collect: 'Разплащане',
  close: 'Разплащане',
}

export interface OpenBillsListProps {
  bills: OpenBill[]
  truncated: boolean
}

/** „На масата“: the live receipts, each a stub with its next step. */
export function OpenBillsList({ bills, truncated }: OpenBillsListProps) {
  if (bills.length === 0) return null
  const sorted = [...bills].sort(
    (a, b) => ORDER[a.nextAction] - ORDER[b.nextAction],
  )

  return (
    <section aria-labelledby="home-open-title" className="flex flex-col gap-4">
      <h2 id="home-open-title" className="text-[15px] font-bold">
        На масата
      </h2>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {sorted.map((bill, index) => (
          <li key={bill.billId} className="list-none">
            <OpenBillStub bill={bill} tilt={index % 2 === 0 ? -0.7 : 0.6} />
          </li>
        ))}
      </ul>
      {truncated ? (
        <p className="text-[11px] text-on-table-muted">
          Показани са последните 50 чернови. По-старите намерете чрез търсене
          по-долу.
        </p>
      ) : null}
    </section>
  )
}

function OpenBillStub({ bill, tilt }: { bill: OpenBill; tilt: number }) {
  const step = bill.nextAction === 'finish' ? bill.firstIncompleteStep : 4
  const name = bill.restaurantName.trim()

  return (
    <Link
      to="/bills/$billId"
      params={{ billId: bill.billId }}
      search={{ step }}
      className="block text-ink transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
      style={{ rotate: `${tilt}deg` }}
      aria-label={`${name || 'Без име'}: ${PHASE[bill.nextAction]}`}
    >
      <div className="paper-lift">
        <div className="paper stub thermal px-4 py-4">
          <div className="flex items-baseline justify-between gap-2 text-[11px] text-ink-muted">
            <span>{shortDate.format(new Date(bill.date))}</span>
            <span>{formatEur(bill.billTotalCents)}</span>
          </div>
          <p
            className={
              name
                ? 'mt-1 truncate font-display text-[15px] font-bold uppercase'
                : 'mt-1 truncate font-display text-[15px] font-bold text-ink-muted uppercase italic'
            }
          >
            {name || 'Без име'}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full bg-ink px-2.5 py-1 font-display text-[10px] font-bold text-paper">
              {PHASE[bill.nextAction]}
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="min-w-0 text-[11px] leading-snug text-ink-muted">
              {bill.nextAction === 'finish'
                ? (bill.missing ?? 'Проверете сметката')
                : bill.owingGuestCount > 0
                  ? `${bill.paidGuestCount} от ${bill.owingGuestCount} платили`
                  : 'Никой не дължи'}
            </p>
            {bill.nextAction === 'collect' ? (
              <span className="stamp stamp-wait shrink-0 text-[10px]">
                Дължат {formatEur(bill.outstandingCents)}
              </span>
            ) : bill.nextAction === 'close' ? (
              <span className="stamp shrink-0 text-[11px]">Всички платиха</span>
            ) : (
              <span className="stamp stamp-wait shrink-0 text-[10px]">
                Чернова
              </span>
            )}
          </div>
          <p className="mt-3 flex items-center justify-end gap-1 text-[12px] font-semibold">
            {bill.nextAction === 'close'
              ? 'Приключи'
              : bill.nextAction === 'collect'
                ? 'Плащания'
                : 'Продължи'}
            <ArrowRightIcon className="size-4" strokeWidth={1.75} aria-hidden />
          </p>
        </div>
      </div>
    </Link>
  )
}
