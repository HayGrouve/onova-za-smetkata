import { formatEur } from '#/lib/format-currency.ts'

export interface OwedSummaryCardProps {
  owedCents: number
  collectedCents: number
  debtorCount: number
  owingBillCount: number
}

function pluralPeople(count: number): string {
  return count === 1 ? '1 човек' : `${count} души`
}

function pluralBills(count: number): string {
  return count === 1 ? '1 сметка' : `${count} сметки`
}

/** „Навън са общо“: Outstanding across open bills, printed on the table. */
export function OwedSummaryCard({
  owedCents,
  collectedCents,
  debtorCount,
  owingBillCount,
}: OwedSummaryCardProps) {
  if (owedCents === 0) {
    return (
      <section aria-label="Дължат ви">
        <p className="text-[12px] text-on-table-muted">Навън са общо</p>
        <p className="mt-1 font-display text-[40px] leading-none font-bold sm:text-[48px]">
          {formatEur(0)}
        </p>
        <p className="mt-2 max-w-[36ch] text-[12px] leading-relaxed text-on-table-muted">
          Никой не ви дължи нищо. Приключете платените сметки по-долу.
        </p>
      </section>
    )
  }

  const expectedCents = owedCents + collectedCents
  const collectedShare = expectedCents > 0 ? collectedCents / expectedCents : 0

  return (
    <section aria-label="Дължат ви">
      <p className="text-[12px] text-on-table-muted">Навън са общо</p>
      <p className="mt-1 font-display text-[40px] leading-none font-bold sm:text-[48px]">
        {formatEur(owedCents)}
      </p>
      <p className="mt-2 text-[12px] text-on-table-muted">
        от {pluralPeople(debtorCount)} в {pluralBills(owingBillCount)}
      </p>
      <div
        className="mt-3 h-[3px] max-w-[320px] rounded-full bg-table-3"
        role="progressbar"
        aria-label="Събрани пари"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(collectedShare * 100)}
      >
        <div
          className="h-full rounded-full bg-stamp"
          style={{ width: `${collectedShare * 100}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-on-table-muted">
        Събрани {formatEur(collectedCents)} от {formatEur(expectedCents)}
      </p>
    </section>
  )
}
