import { ArrowLeftIcon, ArrowRightIcon, PlusIcon } from 'lucide-react'
import {
  QuickActionBar,
  QuickPageHeader,
} from '#/components/quick-bill/quick-layout.tsx'
import { SeatAvatar, useSeats } from '#/components/receipt/seats.tsx'
import { Button } from '#/components/ui/button.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { editQuickBill } from '#/lib/quick-bill-storage.ts'
import { cn } from '#/lib/utils.ts'
import {
  QUICK_BILL_SEATS_MAX,
  setQuickBillSeatCount,
  summarizeQuickBill,
} from '../../../shared/quick-bill.ts'
import type { QuickBill } from '../../../shared/quick-bill.ts'

/** „Чий ред е?“: the phone goes round; each person taps their own seat. */
export function QuickSeats({
  bill,
  onPick,
  onSummary,
  onLines,
}: {
  bill: QuickBill
  onPick: (seatId: string) => void
  onSummary: () => void
  onLines: () => void
}) {
  const seats = useSeats()
  const summary = summarizeQuickBill(bill)
  const shareOf = (id: string) =>
    summary.seats.find((seat) => seat.id === id)?.shareCents ?? 0
  const doneOf = (id: string) =>
    bill.seats.find((seat) => seat.id === id)?.done ?? false
  const doneCount = bill.seats.filter((seat) => seat.done).length

  return (
    <div className="mx-auto w-full max-w-[480px] px-3 pt-4 pb-40 sm:pt-8">
      <QuickPageHeader
        title="Чий ред е?"
        hint="Подайте телефона. Всеки докосва себе си и отбелязва какво е ял и пил."
      />

      <ul className="mt-5 grid grid-cols-2 gap-3" aria-label="Хората на масата">
        {seats.map((seat, index) => {
          const done = doneOf(seat.id)
          return (
            <li key={seat.id} className="list-none">
              <button
                type="button"
                onClick={() => onPick(seat.id)}
                className="block w-full text-left text-ink transition-transform active:scale-[0.98] motion-reduce:transition-none"
                style={{ rotate: `${index % 2 === 0 ? -0.6 : 0.5}deg` }}
              >
                <span className="paper-lift block">
                  <span className="paper stub thermal block px-3 py-3">
                    <span className="flex items-start justify-between gap-2">
                      <SeatAvatar seat={seat} size="md" />
                      {done ? (
                        <span className="stamp shrink-0 text-[10px]">
                          Готов
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-2 block truncate text-[13px] font-semibold">
                      {seat.label}
                    </span>
                    <span
                      className={cn(
                        'block font-display text-[18px] font-bold',
                        shareOf(seat.id) === 0 && 'text-ink-muted',
                      )}
                    >
                      {formatEur(shareOf(seat.id))}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        {seats.length < QUICK_BILL_SEATS_MAX ? (
          <li className="list-none">
            <button
              type="button"
              onClick={() =>
                editQuickBill((b) =>
                  setQuickBillSeatCount(b, b.seats.length + 1),
                )
              }
              className="flex h-full min-h-[120px] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-on-table-muted text-[12px] text-on-table hover:bg-table-2"
            >
              <PlusIcon className="size-5" strokeWidth={1.75} aria-hidden />
              Още човек
            </button>
          </li>
        ) : null}
      </ul>

      <p
        className="mt-5 text-[12px] leading-relaxed text-on-table-muted"
        role="status"
      >
        {doneCount === bill.seats.length
          ? 'Всички отбелязаха.'
          : `Отбелязали: ${doneCount} от ${bill.seats.length}.`}
        {summary.unassignedUnits > 0
          ? ` Никой още не е взел ${summary.unassignedUnits} бр. за ${formatEur(summary.unassignedCents)}.`
          : null}
      </p>

      <div className="mt-4">
        <Button type="button" variant="link" onClick={onLines}>
          <ArrowLeftIcon aria-hidden />
          Редовете на бележката
        </Button>
      </div>

      <QuickActionBar>
        <Button type="button" size="lg" className="w-full" onClick={onSummary}>
          Обобщение
          <ArrowRightIcon aria-hidden />
        </Button>
      </QuickActionBar>
    </div>
  )
}
