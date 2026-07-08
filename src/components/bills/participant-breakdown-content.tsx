import type { ReactNode } from 'react'
import type {
  BillBreakdownInput,
  ParticipantTotals,
  PaymentStatus,
} from '#/lib/bill-calculations.ts'
import { calculateParticipantBreakdown } from '#/lib/bill-calculations.ts'
import {
  formatBreakdownLineLabel,
  formatBreakdownLineSuffix,
} from '#/lib/bill-share.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { Badge } from '#/components/ui/badge.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import { ParticipantPayActions } from '#/components/bills/participant-pay-actions.tsx'
import { PaymentActions } from '#/components/bills/payment-actions.tsx'
import type { Id } from '../../../convex/_generated/dataModel'

const statusLabels: Record<PaymentStatus, string> = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
}

export interface ParticipantBreakdownContentProps {
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  breakdownInput: BillBreakdownInput
  totals: ParticipantTotals
  onOpenPaymentSettings?: () => void
  /** Host summary sheet: show mark-paid controls. Hidden for guests. */
  showPaymentActions?: boolean
  /** Show Revolut button in breakdown block. Claim page uses sticky footer instead. */
  showPayActions?: boolean
  /** Hide status badge (e.g. when shown in a parent header). */
  showStatusBadge?: boolean
  /** Claim footer: skip duplicate totals grid; use `summaryFooter` instead. */
  summaryVariant?: 'default' | 'claim-footer'
  summaryFooter?: ReactNode
}

export function ParticipantBreakdownContent({
  billId,
  participantId,
  label,
  breakdownInput,
  totals,
  onOpenPaymentSettings,
  showPaymentActions = true,
  showPayActions = true,
  showStatusBadge = true,
  summaryVariant = 'default',
  summaryFooter,
}: ParticipantBreakdownContentProps) {
  const breakdown = calculateParticipantBreakdown(
    breakdownInput,
    participantId,
  )
  const remainingCents = Math.max(0, totals.balanceCents)
  const participantCount = breakdownInput.participants.length

  return (
    <div className="flex flex-col gap-3">
      {showStatusBadge ? (
        <div className="flex items-center justify-end">
          <Badge variant="outline">{statusLabels[totals.status]}</Badge>
        </div>
      ) : null}

      {breakdown.lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Няма разпределени артикули.
        </p>
      ) : (
        breakdown.lines.map((line, index) => (
          <div
            key={`${line.kind}-${line.label}-${index}`}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <p className="text-muted-foreground">
              {formatBreakdownLineLabel(line, participantCount)}
              {line.kind === 'item' ? formatBreakdownLineSuffix(line) : ''}
            </p>
            <p className="shrink-0 tabular-nums">{formatEur(line.amountCents)}</p>
          </div>
        ))
      )}

      <Separator />

      {summaryVariant === 'claim-footer' ? (
        <>
          {totals.paidCents > 0 ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Дължи</p>
                <p className="font-medium tabular-nums">
                  {formatEur(totals.owedCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Платено</p>
                <p className="font-medium tabular-nums">
                  {formatEur(totals.paidCents)}
                </p>
              </div>
            </div>
          ) : null}
          {summaryFooter}
        </>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Дължи</p>
            <p className="font-medium tabular-nums">{formatEur(totals.owedCents)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Платено</p>
            <p className="font-medium tabular-nums">{formatEur(totals.paidCents)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Остатък</p>
            <p className="font-medium tabular-nums">{formatEur(remainingCents)}</p>
          </div>
        </div>
      )}

      {showPayActions && remainingCents > 0 ? (
        <ParticipantPayActions
          remainingCents={remainingCents}
          label={label}
          onOpenSettings={onOpenPaymentSettings}
        />
      ) : null}

      {showPaymentActions ? (
        <PaymentActions
          billId={billId}
          participantId={participantId}
          label={label}
          totals={totals}
        />
      ) : null}
    </div>
  )
}
