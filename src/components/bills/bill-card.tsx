import { Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { MoreVerticalIcon } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { api } from '../../../convex/_generated/api'
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
  const removeBill = useMutation(api.bills.remove)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const isDraft = bill.status === 'draft'
  const to = isDraft ? '/bills/$billId' : '/bills/$billId/summary'

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await removeBill({ billId: bill._id })
      setDeleteOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="gap-3 py-4 transition-colors interactive-hover active:bg-accent">
      <CardContent className="flex items-center gap-3 px-4">
        <Link
          to={to}
          params={{ billId: bill._id }}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 tap-feedback"
          data-interactive="true"
        >
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
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label="Опции за сметка"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <MoreVerticalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                e.preventDefault()
                setDeleteOpen(true)
              }}
            >
              Изтрий
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Изтриване на сметка</DialogTitle>
            <DialogDescription>
              Това действие е необратимо. Всички участници, артикули и
              плащания ще бъдат изтрити заедно със сметката.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              Изтрий сметката
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
