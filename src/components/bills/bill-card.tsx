import { Link } from '@tanstack/react-router'
import { Badge } from '#/components/ui/badge.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import type { Doc } from '../../../convex/_generated/dataModel'

const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export interface BillSummary {
  bill: Doc<'bills'>
  participantNames: string[]
  billTotalCents: number
  totalOutstandingCents: number | null
}

export function BillCard({
  bill,
  billTotalCents,
  totalOutstandingCents,
}: BillSummary) {
  const isDraft = bill.status === 'draft'
  const to = isDraft ? '/bills/$billId' : '/bills/$billId/summary'

  return (
    <Link to={to} params={{ billId: bill._id }} className="block">
      <Card className="gap-3 py-4 transition-colors active:bg-accent">
        <CardContent className="flex items-center justify-between gap-3 px-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">
                {bill.restaurantName.trim() || 'Без име'}
              </span>
              {isDraft && <Badge variant="secondary">Чернова</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {dateFormatter.format(new Date(bill.date))}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold tabular-nums">
              {formatEur(billTotalCents)}
            </p>
            {!isDraft && (
              <p className="text-sm text-muted-foreground tabular-nums">
                {totalOutstandingCents && totalOutstandingCents > 0
                  ? `Дължимо ${formatEur(totalOutstandingCents)}`
                  : 'Платено'}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
