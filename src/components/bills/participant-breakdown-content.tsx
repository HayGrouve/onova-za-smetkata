import type { ReactNode } from 'react'
import type {
  BillBreakdownInput,
  ParticipantTotals,
} from '#/lib/bill-calculations.ts'
import { buildParticipantShareView } from '#/lib/participant-share-view.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { Badge } from '#/components/ui/badge.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import { ParticipantPayActions } from '#/components/bills/participant-pay-actions.tsx'
import { PaymentActions } from '#/components/bills/payment-actions.tsx'
import type { Id, Doc } from '../../../convex/_generated/dataModel'

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
  const shareView = buildParticipantShareView({
    breakdownInput,
    totals,
    participantId,
    participantLabels,
  })

  return (
    <div className="flex flex-col gap-3">
      {showStatusBadge ? (
        <div className="flex items-center justify-end">
          <Badge variant="outline">{shareView.statusLabel}</Badge>
        </div>
      ) : null}

      {shareView.isEmpty ? (
        <p className="text-sm text-muted-foreground">
          Няма разпределени артикули.
        </p>
      ) : (
        shareView.lines.map((line) => (
          <div
            key={line.key}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-muted-foreground">{line.label}</p>
              {line.unitsText ? (
                <p className="text-xs text-muted-foreground">
                  {line.unitsText}
                </p>
              ) : null}
              {line.sharedText ? (
                <p className="text-xs text-muted-foreground">
                  {line.sharedText}
                </p>
              ) : null}
            </div>
            <p className="money shrink-0">{formatEur(line.amountCents)}</p>
          </div>
        ))
      )}

      {summaryVariant === 'claim-footer' && summaryFooter == null ? null : (
        <>
          <Separator />

          {summaryVariant === 'claim-footer' ? (
            <>
              {shareView.totals.paidCents > 0 ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Дължи</p>
                    <p className="money font-medium">
                      {formatEur(shareView.totals.owedCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Платено</p>
                    <p className="money font-medium">
                      {formatEur(shareView.totals.paidCents)}
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
                  {formatEur(shareView.totals.owedCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Платено</p>
                <p className="money font-medium">
                  {formatEur(shareView.totals.paidCents)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Остатък</p>
                <p className="money font-medium">
                  {formatEur(shareView.remainingCents)}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {showPayActions && shareView.remainingCents > 0 ? (
        <ParticipantPayActions
          remainingCents={shareView.remainingCents}
          label={label}
          onOpenSettings={onOpenPaymentSettings}
        />
      ) : null}

      {showPaymentActions ? (
        <PaymentActions
          billId={billId}
          participantId={participantId}
          label={label}
          totals={shareView.totals}
          payments={payments}
          readOnly={paymentActionsReadOnly}
        />
      ) : null}
    </div>
  )
}
