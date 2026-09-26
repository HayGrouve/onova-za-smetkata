import { PartyPopperIcon, WalletIcon } from 'lucide-react'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { formatEur } from '#/lib/format-currency.ts'

export interface OwedSummaryCardProps {
  owedCents: number
  collectedCents: number
  debtorCount: number
  owingBillCount: number
}

function pluralPeople(count: number): string {
  return count === 1 ? '1 човек' : `${count} човека`
}

function pluralBills(count: number): string {
  return count === 1 ? '1 сметка' : `${count} сметки`
}

/** „Дължат ви“: Outstanding across open bills, and how much is already in. */
export function OwedSummaryCard({
  owedCents,
  collectedCents,
  debtorCount,
  owingBillCount,
}: OwedSummaryCardProps) {
  if (owedCents === 0) {
    return (
      <Card className="border-success/30 bg-success/5 py-4">
        <CardContent className="flex items-center gap-3 px-4">
          <PartyPopperIcon className="size-5 text-success" aria-hidden />
          <div>
            <p className="font-medium">Никой не ви дължи нищо</p>
            <p className="text-sm text-muted-foreground">
              Всички гости са платили. Приключете сметките по-долу.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const expectedCents = owedCents + collectedCents
  const collectedShare = expectedCents > 0 ? collectedCents / expectedCents : 0

  return (
    <Card className="py-4">
      <CardContent className="flex flex-col gap-3 px-4">
        <div>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <WalletIcon className={ICON.section} aria-hidden />
            Дължат ви
          </p>
          <p className="money text-3xl font-bold text-primary">
            {formatEur(owedCents)}
          </p>
          <p className="text-sm text-muted-foreground">
            от {pluralPeople(debtorCount)} в {pluralBills(owingBillCount)}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <div
            className="flex h-2 overflow-hidden rounded-full bg-primary/20"
            role="progressbar"
            aria-label="Събрани пари"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(collectedShare * 100)}
          >
            <div
              className="h-full bg-success"
              style={{ width: `${collectedShare * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Събрани <span className="money">{formatEur(collectedCents)}</span>{' '}
            от <span className="money">{formatEur(expectedCents)}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
