import { CopyIcon } from 'lucide-react'
import { copyRemainingAmount } from '#/components/bills/participant-pay-actions.tsx'
import { PaymentActions } from '#/components/bills/payment-actions.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import type {
  ParticipantTotals,
  PaymentStatus,
} from '#/lib/bill-calculations.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { getPaymentRowBorderClass } from '#/lib/payment-row-styles.ts'
import { cn } from '#/lib/utils.ts'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

const statusLabels: Record<PaymentStatus, string> = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
}

const statusVariants: Record<
  PaymentStatus,
  'outline' | 'secondary' | 'default'
> = {
  unpaid: 'outline',
  partial: 'secondary',
  paid: 'default',
}

export interface PaymentRowProps {
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  totals: ParticipantTotals
  payments?: Doc<'payments'>[]
  /** Host is paid-by-rule; never show collection affordances. */
  isHost?: boolean
  readOnly?: boolean
  onOpenDetail?: () => void
}

export function PaymentRow({
  billId,
  participantId,
  label,
  totals,
  payments,
  isHost = false,
  readOnly = false,
  onOpenDetail,
}: PaymentRowProps) {
  const remainingCents = Math.max(0, totals.balanceCents)

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-3',
        getPaymentRowBorderClass(totals.status),
      )}
    >
      {onOpenDetail ? (
        <button
          type="button"
          onClick={onOpenDetail}
          className="tap-feedback flex items-center justify-between gap-2 text-left"
        >
          <p className="font-medium">{label}</p>
          <Badge variant={statusVariants[totals.status]}>
            {statusLabels[totals.status]}
          </Badge>
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{label}</p>
          <Badge variant={statusVariants[totals.status]}>
            {statusLabels[totals.status]}
          </Badge>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
        <div>
          <p className="text-xs">Дължи</p>
          <p className="money text-foreground">{formatEur(totals.owedCents)}</p>
        </div>
        <div>
          <p className="text-xs">Платено</p>
          <p className="money text-foreground">{formatEur(totals.paidCents)}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs">
            Остатък
            {remainingCents > 0 ? (
              <CopyIcon className="size-3 text-muted-foreground" aria-hidden />
            ) : null}
          </p>
          {remainingCents > 0 ? (
            <button
              type="button"
              onClick={() => copyRemainingAmount(remainingCents)}
              className="tap-feedback money cursor-pointer text-foreground"
              aria-label="Копирай сумата"
            >
              {formatEur(remainingCents)}
            </button>
          ) : (
            <p className="money text-foreground">{formatEur(remainingCents)}</p>
          )}
        </div>
      </div>
      {!isHost ? (
        <PaymentActions
          billId={billId}
          participantId={participantId}
          label={label}
          totals={totals}
          payments={payments}
          readOnly={readOnly}
        />
      ) : null}
    </div>
  )
}
