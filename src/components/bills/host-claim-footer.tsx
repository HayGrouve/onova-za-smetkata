import { ClaimShareDrawer } from '#/components/bills/claim-share-drawer.tsx'
import { ParticipantBreakdownContent } from '#/components/bills/participant-breakdown-content.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import type {
  BillBreakdownInput,
  ParticipantTotals,
} from '#/lib/bill-calculations.ts'
import { formatEur } from '#/lib/format-currency.ts'
import type { Id } from '../../../convex/_generated/dataModel'

export interface HostClaimFooterProps {
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  breakdownInput: BillBreakdownInput
  totals: ParticipantTotals
  participantLabels?: Record<string, string>
  readOnly?: boolean
}

export function HostClaimFooter({
  billId,
  participantId,
  label,
  breakdownInput,
  totals,
  participantLabels,
}: HostClaimFooterProps) {
  return (
    <ClaimShareDrawer
      title="Разбивка на дяла"
      status={<Badge variant="outline">платено</Badge>}
      details={
        <ParticipantBreakdownContent
          billId={billId}
          participantId={participantId}
          label={label}
          breakdownInput={breakdownInput}
          totals={{ ...totals, paidCents: 0 }}
          showPaymentActions={false}
          showPayActions={false}
          showStatusBadge={false}
          summaryVariant="claim-footer"
          participantLabels={participantLabels}
          summaryFooter={null}
        />
      }
      summary={
        <>
          <div className="text-right text-sm">
            <p className="text-xs text-muted-foreground">Дял</p>
            <p className="money font-medium">{formatEur(totals.owedCents)}</p>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Покрито като домакин
          </p>
        </>
      }
    />
  )
}
