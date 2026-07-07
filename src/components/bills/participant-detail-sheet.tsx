import type {
  BillBreakdownInput,
  ParticipantTotals,
  PaymentStatus,
} from '#/lib/bill-calculations.ts'
import {
  calculateParticipantBreakdown,
} from '#/lib/bill-calculations.ts'
import {
  formatBreakdownLineLabel,
  formatBreakdownLineSuffix,
} from '#/lib/bill-share.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { Badge } from '#/components/ui/badge.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { ParticipantPayActions } from '#/components/bills/participant-pay-actions.tsx'
import { PaymentActions } from '#/components/bills/payment-actions.tsx'
import type { Id } from '../../../convex/_generated/dataModel'

const statusLabels: Record<PaymentStatus, string> = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
}

export interface ParticipantDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  breakdownInput: BillBreakdownInput
  totals: ParticipantTotals
  onOpenPaymentSettings?: () => void
}

export function ParticipantDetailSheet({
  open,
  onOpenChange,
  billId,
  participantId,
  label,
  breakdownInput,
  totals,
  onOpenPaymentSettings,
}: ParticipantDetailSheetProps) {
  const breakdown = calculateParticipantBreakdown(
    breakdownInput,
    participantId,
  )
  const remainingCents = Math.max(0, totals.balanceCents)
  const participantCount = breakdownInput.participants.length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-h-[85vh] max-w-lg rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between gap-2 pr-8">
            <span>{label}</span>
            <Badge variant="outline">{statusLabels[totals.status]}</Badge>
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
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

          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Дължи</p>
              <p className="tabular-nums font-medium">{formatEur(totals.owedCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Платено</p>
              <p className="tabular-nums font-medium">{formatEur(totals.paidCents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Остатък</p>
              <p className="tabular-nums font-medium">{formatEur(remainingCents)}</p>
            </div>
          </div>

          {remainingCents > 0 ? (
            <ParticipantPayActions
              remainingCents={remainingCents}
              label={label}
              onOpenSettings={onOpenPaymentSettings}
            />
          ) : null}

          <PaymentActions
            billId={billId}
            participantId={participantId}
            label={label}
            totals={totals}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}
