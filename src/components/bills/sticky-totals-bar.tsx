import { Link } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { calculateBillTotals } from '#/lib/bill-calculations.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

const statusLabels = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
} as const

export interface StickyTotalsBarProps {
  billId: Id<'bills'>
  participants: Doc<'participants'>[]
  items: Doc<'items'>[]
  assignments: Doc<'itemAssignments'>[]
  payments: Doc<'payments'>[]
}

export function StickyTotalsBar({
  billId,
  participants,
  items,
  assignments,
  payments,
}: StickyTotalsBarProps) {
  const [open, setOpen] = useState(false)

  const labels = useMemo(
    () => buildParticipantLabels(participants),
    [participants],
  )

  const totals = useMemo(
    () =>
      calculateBillTotals({
        participants: participants.map((p) => ({
          id: p._id,
          sortOrder: p.sortOrder,
        })),
        items: items.map((i) => ({
          id: i._id,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
        })),
        assignments: assignments.map((a) => ({
          itemId: a.itemId,
          participantId: a.participantId,
        })),
        payments: payments.map((p) => ({
          participantId: p.participantId,
          amountCents: p.amountCents,
        })),
      }),
    [participants, items, assignments, payments],
  )

  const sortedParticipants = useMemo(
    () => [...participants].sort((a, b) => a.sortOrder - b.sortOrder),
    [participants],
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto max-w-lg">
          <Link
            to="/bills/$billId/summary"
            params={{ billId }}
            className="flex h-11 items-center justify-center gap-1 border-b text-sm font-medium text-primary"
          >
            Преглед
            <ChevronRightIcon className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
          >
            <div className="shrink-0">
              <p className="text-xs text-muted-foreground">Общо</p>
              <p className="font-semibold tabular-nums">
                {formatEur(totals.billTotalCents)}
              </p>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex flex-1 gap-3 overflow-x-auto">
              {sortedParticipants.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Добавете участници
                </p>
              )}
              {sortedParticipants.map((p) => (
                <div key={p._id} className="shrink-0">
                  <p className="truncate text-xs text-muted-foreground">
                    {labels[p._id] ?? p.name}
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    {formatEur(totals.byParticipant[p._id].owedCents)}
                  </p>
                </div>
              ))}
            </div>
          </button>
        </div>
      </div>

      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Разбивка на сметката</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
          <div className="flex items-center justify-between font-semibold">
            <span>Обща сума</span>
            <span className="tabular-nums">
              {formatEur(totals.billTotalCents)}
            </span>
          </div>
          <Separator />
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
                <p className="tabular-nums">{formatEur(t.owedCents)}</p>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
