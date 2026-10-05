import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import { useQuickBill } from '#/hooks/use-quick-bill.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { summarizeQuickBill } from '../../../shared/quick-bill.ts'

/** Home: the quick bill still on this phone, one tap back into it. */
export function QuickBillResume() {
  const stored = useQuickBill()
  if (!stored) return null
  const { bill, scan } = stored
  const started = bill.lines.length > 0 && scan.phase === 'read'
  const done = bill.seats.filter((seat) => seat.done).length
  const name = bill.restaurantName.trim()

  return (
    <Link
      to="/quick-bill"
      search={started ? { view: 'seats' } : {}}
      className="block text-ink transition-transform hover:-translate-y-0.5 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
    >
      <span className="paper-lift block">
        <span className="paper stub thermal block px-4 py-3">
          <span className="flex items-baseline justify-between gap-2 text-[11px] text-ink-muted">
            <span>Бърза сметка</span>
            {started ? (
              <span className="tabular-nums">
                {formatEur(summarizeQuickBill(bill).totalCents)}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block truncate font-display text-[15px] font-bold uppercase">
            {name || 'Продължете оттам, докъдето стигнахте'}
          </span>
          <span className="mt-2 flex items-end justify-between gap-3">
            <span className="text-[11px] text-ink-muted">
              {started
                ? `${bill.seats.length} души, отбелязали ${done}`
                : 'Редовете още не са готови'}
            </span>
            <span className="flex items-center gap-1 text-[12px] font-semibold">
              Продължи
              <ArrowRightIcon
                className="size-4"
                strokeWidth={1.75}
                aria-hidden
              />
            </span>
          </span>
        </span>
      </span>
    </Link>
  )
}
