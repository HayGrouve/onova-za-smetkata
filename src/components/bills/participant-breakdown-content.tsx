import type { ReactNode } from 'react'
import type {
  BillBreakdownInput,
  ParticipantTotals,
  PaymentStatus,
} from '#/lib/bill-calculations.ts'
import { calculateParticipantBreakdown } from '#/lib/bill-calculations.ts'
import {
  formatBreakdownLineLabel,
  formatBreakdownLineSharedText,
  formatBreakdownLineUnitsText,
} from '#/lib/bill-share.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { Badge } from '#/components/ui/badge.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import { ParticipantPayActions } from '#/components/bills/participant-pay-actions.tsx'
import { PaymentActions } from '#/components/bills/payment-actions.tsx'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Doc } from '../../../convex/_generated/dataModel'

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
  payments?: Doc<'payments'>[]
  onOpenPaymentSettings?: () => void
  /** Host summary sheet: show mark-paid controls. Hidden for guests. */
  showPaymentActions?: boolean
  /** When true, payment history stays visible but mutate controls are hidden. */
  paymentActionsReadOnly?: boolean
  /** Show Revolut button in breakdown block. Claim page uses sticky footer instead. */
  showPayActions?: boolean
  /** Hide status badge (e.g. when shown in a parent header). */
  showStatusBadge?: boolean
  /** Claim footer: skip duplicate totals grid; use `summaryFooter` instead. */
  summaryVariant?: 'default' | 'claim-footer'
  /** When `claim-footer` and `null`, render lines only (no separator/totals). */
  summaryFooter?: ReactNode
  /** Participant id → display label for shared-item suffixes. */
  participantLabels?: Record<string, string>
}

export function ParticipantBreakdownContent({
  billId,
  participantId,
  label,
  breakdownInput,
  totals,
  payments,
  onOpenPaymentSettings,
  showPaymentActions = true,
  paymentActionsReadOnly = false,
  showPayActions = true,
  showStatusBadge = true,
  summaryVariant = 'default',
  summaryFooter,
  participantLabels,
}: ParticipantBreakdownContentProps) {
  const breakdown = calculateParticipantBreakdown(breakdownInput, participantId)
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
        breakdown.lines.map((line, index) => {
          const unitsText =
            line.kind === 'item'
              ? formatBreakdownLineUnitsText(line)
              : undefined
          const sharedText =
            line.kind === 'item'
              ? formatBreakdownLineSharedText(line, participantLabels)
              : undefined

          return (
            <div
              key={`${line.kind}-${line.kind === 'item' ? line.itemId : line.label}-${index}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-muted-foreground">
                  {formatBreakdownLineLabel(line, participantCount)}
                </p>
                {unitsText ? (
                  <p className="text-xs text-muted-foreground">{unitsText}</p>
                ) : null}
                {sharedText ? (
                  <p className="text-xs text-muted-foreground">{sharedText}</p>
                ) : null}
              </div>
              <p className="money shrink-0">{formatEur(line.amountCents)}</p>
            </div>
          )
        })
      )}

      {summaryVariant === 'claim-footer' && summaryFooter == null ? null : (
        <>
          <Separator />

          {summaryVariant === 'claim-footer' ? (
            <>
              {totals.paidCents > 0 ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Дължи</p>
                    <p className="money font-medium">
                      {formatEur(totals.owedCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Платено</p>
                    <p className="money font-medium">
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
                <p className="money font-medium">
                  {formatEur(totals.owedCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Платено</p>
                <p className="money font-medium">
                  {formatEur(totals.paidCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Остатък</p>
                <p className="money font-medium">{formatEur(remainingCents)}</p>
              </div>
            </div>
          )}
        </>
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
          payments={payments}
          readOnly={paymentActionsReadOnly}
        />
      ) : null}
    </div>
  )
}
