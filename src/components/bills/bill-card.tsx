import { Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { MoreVerticalIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { getBillDeleteCopy } from '#/lib/destructive-action-copy.ts'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'
import { deriveBillNextAction } from '../../../shared/bill-collection.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc } from '../../../convex/_generated/dataModel'

const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Sofia',
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
  tilt = 0,
}: BillSummary & {
  /** Degrees: stubs on the shelf sit slightly crooked. */
  tilt?: number
}) {
  const removeBill = useMutation(api.bills.remove)
  const { confirm } = useConfirmAction()
  const [isDeleting, setIsDeleting] = useState(false)
  const isDraft = bill.status === 'draft'
  const draftStatus = isDraft ? draftStatusLabel(bill) : null
  const to = isDraft ? '/bills/$billId' : '/bills/$billId/summary'

  async function handleDeleteWithConfirm() {
    const confirmed = await confirm(getBillDeleteCopy())
    if (!confirmed) return
    setIsDeleting(true)
    try {
      await removeBill({ billId: bill._id })
    } catch {
      toast.error('Неуспешно изтриване на сметката')
    } finally {
      setIsDeleting(false)
    }
  }

  const owes = !isDraft && (totalOutstandingCents ?? 0) > 0

  return (
    <div className="paper-lift" style={{ rotate: `${tilt}deg` }}>
      <div className="paper stub relative flex items-start gap-1 py-4 pr-1 pl-4">
        <Link
          to={to}
          params={{ billId: bill._id }}
          className="min-w-0 flex-1 text-ink"
          data-interactive="true"
        >
          <div className="flex items-baseline justify-between gap-2 text-[11px] text-ink-muted">
            <span>{dateFormatter.format(new Date(bill.date))}</span>
            <span>{formatEur(billTotalCents)}</span>
          </div>
          <p
            className={cn(
              'mt-1 truncate font-display text-[15px] font-bold text-stamp-ink uppercase',
              !bill.restaurantName.trim() && 'text-ink-muted italic',
            )}
          >
            {bill.restaurantName.trim() || 'Без име'}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="min-w-0 text-[11px] leading-snug text-ink-muted">
              {draftStatus?.tone === 'collect'
                ? `Остава ${formatEur(bill.listOutstandingCents ?? 0)}`
                : owes
                  ? `Дължимо ${formatEur(totalOutstandingCents ?? 0)}`
                  : isDraft
                    ? draftStatus?.label
                    : 'Платено'}
            </p>
            {isDraft ? (
              <span
                className={cn(
                  'stamp shrink-0 text-[10px]',
                  draftStatus?.tone !== 'close' && 'stamp-wait',
                )}
              >
                {draftStatus?.label}
              </span>
            ) : (
              <span className="stamp shrink-0 text-[11px]">Приключена</span>
            )}
          </div>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="-mt-1 shrink-0 text-ink-muted"
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
              disabled={isDeleting}
              onSelect={(e) => {
                e.preventDefault()
                void handleDeleteWithConfirm()
              }}
            >
              <Trash2Icon className={ICON.button} aria-hidden />
              Изтрий
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

/** Draft bills split into „Чернова“ vs money still being collected. */
function draftStatusLabel(bill: Doc<'bills'>): {
  label: string
  tone: 'finish' | 'collect' | 'close'
} {
  if (bill.listPrepared === undefined)
    return { label: 'Чернова', tone: 'finish' }
  const action = deriveBillNextAction({
    status: 'draft',
    prepared: bill.listPrepared,
    outstandingCents: bill.listOutstandingCents ?? 0,
  })
  if (action === 'collect') return { label: 'Чака плащания', tone: 'collect' }
  if (action === 'close') return { label: 'За приключване', tone: 'close' }
  return { label: 'Чернова', tone: 'finish' }
}
