import { PieChartIcon } from 'lucide-react'
import { useCallback } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { ClaimShareDrawer } from '#/components/bills/claim-share-drawer.tsx'
import { ParticipantBreakdownContent } from '#/components/bills/participant-breakdown-content.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { ICON } from '#/lib/app-icons.ts'
import type {
  BillBreakdownInput,
  ParticipantTotals,
} from '#/lib/bill-calculations.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { itemUsesUnitAssignments } from '#/lib/guest-claim-items.ts'
import { api } from '../../../convex/_generated/api'
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
  readOnly = false,
}: HostClaimFooterProps) {
  const toggleAssignment = useMutation(api.assignments.toggle)
  const setUnits = useMutation(api.assignments.setUnits)

  const handleRemoveItem = useCallback(
    async (itemId: Id<'items'>) => {
      if (readOnly) return
      try {
        const item = breakdownInput.items.find((entry) => entry.id === itemId)
        const assignment = breakdownInput.assignments.find(
          (entry) =>
            entry.itemId === itemId && entry.participantId === participantId,
        )
        const myUnits = assignment?.units ?? 0

        if (item && item.quantity > 1) {
          await setUnits({
            itemId,
            participantId,
            units: myUnits - 1,
          })
          return
        }

        if (
          itemUsesUnitAssignments(
            itemId,
            breakdownInput.assignments.map((entry) => ({
              itemId: entry.itemId as Id<'items'>,
              participantId: entry.participantId as Id<'participants'>,
              units: entry.units,
            })),
          )
        ) {
          await setUnits({ itemId, participantId, units: 0 })
        } else {
          await toggleAssignment({ itemId, participantId })
        }
      } catch (error) {
        toast.error(getConvexErrorMessage(error))
      }
    },
    [
      breakdownInput.assignments,
      breakdownInput.items,
      participantId,
      readOnly,
      setUnits,
      toggleAssignment,
    ],
  )

  return (
    <ClaimShareDrawer
      title={
        <>
          <PieChartIcon className={ICON.section} aria-hidden />
          Разбивка на дяла
        </>
      }
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
          removableItemLines
          readOnly={readOnly}
          participantLabels={participantLabels}
          onRemoveItem={handleRemoveItem}
          summaryFooter={null}
        />
      }
      summary={
        <>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Дял</p>
              <p className="money font-medium">
                {formatEur(totals.owedCents)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Остатък</p>
              <p className="money font-medium">{formatEur(0)}</p>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Покрито като домакин
          </p>
        </>
      }
    />
  )
}
