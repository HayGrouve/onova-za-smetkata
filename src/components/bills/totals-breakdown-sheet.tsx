import { PieChartIcon } from 'lucide-react'
import { useMemo } from 'react'
import type { calculateBillTotals } from '#/lib/bill-calculations.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { ICON } from '#/lib/app-icons.ts'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import type { Doc } from '../../../convex/_generated/dataModel'

const statusLabels = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
} as const

export interface TotalsBreakdownSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  totals: ReturnType<typeof calculateBillTotals>
  participants: Doc<'participants'>[]
  labels: Record<string, string>
}

export function TotalsBreakdownSheet({
  open,
  onOpenChange,
  totals,
  participants,
  labels,
}: TotalsBreakdownSheetProps) {
  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => a.sortOrder - b.sortOrder),
    [participants],
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PieChartIcon className={ICON.section} aria-hidden />
            Разбивка на сметката
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
          <div className="flex items-center justify-between font-semibold">
            <span>Обща сума</span>
            <span className="money">{formatEur(totals.billTotalCents)}</span>
          </div>
          <Separator />
          {sortedParticipants.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Няма участници.
            </p>
          )}
          {sortedParticipants.map((p) => {
            const t = totals.byParticipant[p._id]
            return (
              <div
                key={p._id}
                className="flex items-center justify-between gap-2"
              >
                <div>
                  <p className="font-medium">{labels[p._id] ?? p.name}</p>
                  <Badge variant="outline" className="mt-0.5">
                    {statusLabels[t.status]}
                  </Badge>
                </div>
                <p className="money">{formatEur(t.owedCents)}</p>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
