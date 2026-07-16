import { PieChartIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { ParticipantBreakdownContent } from '#/components/bills/participant-breakdown-content.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Separator } from '#/components/ui/separator.tsx'
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
  const footerRef = useRef<HTMLDivElement>(null)
  const [spacerHeight, setSpacerHeight] = useState(0)

  useEffect(() => {
    const footer = footerRef.current
    if (!footer) return

    const updateSpacer = () => setSpacerHeight(footer.offsetHeight)
    updateSpacer()

    const observer = new ResizeObserver(updateSpacer)
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

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
    <>
      <div aria-hidden style={{ height: spacerHeight }} />
      <div
        ref={footerRef}
        className="fixed inset-x-0 bottom-0 z-40 max-h-[min(75dvh,36rem)] overflow-y-auto border-t sticky-surface px-4 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
      >
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <PieChartIcon className={ICON.section} aria-hidden />
              Разбивка на дяла
            </h3>
            <Badge variant="outline">платено</Badge>
          </div>

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
            summaryFooter={
              <>
                <Separator />
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
        </div>
      </div>
    </>
  )
}
