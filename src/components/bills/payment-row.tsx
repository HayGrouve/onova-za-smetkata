import { Badge } from '#/components/ui/badge.tsx'
import { PaymentActions } from '#/components/bills/payment-actions.tsx'
import type {
  ParticipantTotals,
  PaymentStatus,
} from '#/lib/bill-calculations.ts'
import { formatEur } from '#/lib/format-currency.ts'
import type { Id } from '../../../convex/_generated/dataModel'

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
  onOpenDetail?: () => void
}

export function PaymentRow({
  billId,
  participantId,
  label,
  totals,
  onOpenDetail,
}: PaymentRowProps) {
  const remainingCents = Math.max(0, totals.balanceCents)

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
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
          <p className="tabular-nums text-foreground">
            {formatEur(totals.owedCents)}
          </p>
        </div>
        <div>
          <p className="text-xs">Платено</p>
          <p className="tabular-nums text-foreground">
            {formatEur(totals.paidCents)}
          </p>
        </div>
        <div>
          <p className="text-xs">Остатък</p>
          <p className="tabular-nums text-foreground">
            {formatEur(remainingCents)}
          </p>
        </div>
      </div>
      <PaymentActions
        billId={billId}
        participantId={participantId}
        label={label}
        totals={totals}
      />
    </div>
  )
}
