import type { ReactNode } from 'react'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
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
import { getClaimUnassignCopy } from '#/lib/destructive-action-copy.ts'
import { Badge } from '#/components/ui/badge.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import { CircleXIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
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
  /** Claim footer: show remove control on assigned item lines. */
  removableItemLines?: boolean
  readOnly?: boolean
  onRemoveItem?: (itemId: Id<'items'>) => void | Promise<void>
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
  removableItemLines = false,
  readOnly = false,
  onRemoveItem,
  participantLabels,
}: ParticipantBreakdownContentProps) {
  const { confirm } = useConfirmAction()
  const breakdown = calculateParticipantBreakdown(breakdownInput, participantId)
  const remainingCents = Math.max(0, totals.balanceCents)
  const participantCount = breakdownInput.participants.length

  async function handleRemoveItemWithConfirm(
    itemId: Id<'items'>,
    label: string,
  ) {
    const confirmed = await confirm(getClaimUnassignCopy(label))
    if (!confirmed) return
    await onRemoveItem?.(itemId)
  }

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
            key={`${line.kind}-${line.kind === 'item' ? line.itemId : line.label}-${index}`}
            className="flex items-start justify-between gap-3 text-sm"
          >
            <div className="flex min-w-0 items-start gap-2">
              {removableItemLines &&
              line.kind === 'item' &&
              !readOnly &&
              onRemoveItem ? (
                <button
                  type="button"
                  onClick={() =>
                    void handleRemoveItemWithConfirm(
                      line.itemId as Id<'items'>,
                      line.label,
                    )
                  }
                  className={cn(
                    'tap-feedback -ml-1 shrink-0 rounded-md p-1 text-primary/75',
                    'hover:text-primary dark:text-primary/85',
                  )}
                  aria-label={`Премахни ${line.label}`}
                >
                  <CircleXIcon className="size-4" aria-hidden />
                </button>
              ) : null}
              <p className="text-muted-foreground">
                {formatBreakdownLineLabel(line, participantCount)}
                {line.kind === 'item'
                  ? formatBreakdownLineSuffix(line, participantLabels)
                  : ''}
              </p>
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
