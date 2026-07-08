import { SendIcon, PieChartIcon } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ParticipantBreakdownContent } from '#/components/bills/participant-breakdown-content.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import type {
  BillBreakdownInput,
  ParticipantTotals,
  PaymentStatus,
} from '#/lib/bill-calculations.ts'
import { formatCopyAmount } from '#/lib/bill-share.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { buildRevolutUrl } from '#/lib/payment-settings.ts'
import { copyToClipboard } from '#/lib/copy-to-clipboard.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { itemUsesUnitAssignments } from '#/lib/guest-claim-items.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

const statusLabels: Record<PaymentStatus, string> = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
}

export interface GuestClaimFooterProps {
  billId: Id<'bills'>
  participantId: Id<'participants'>
  sessionToken: string
  label: string
  breakdownInput: BillBreakdownInput
  totals: ParticipantTotals
  readOnly?: boolean
}

export function GuestClaimFooter({
  billId,
  participantId,
  sessionToken,
  label,
  breakdownInput,
  totals,
  readOnly = false,
}: GuestClaimFooterProps) {
  const settings = useQuery(api.paymentSettings.getForGuest, { billId })
  const toggleAssignment = useMutation(api.assignments.toggle)
  const setUnits = useMutation(api.assignments.setUnits)
  const revolutUsername = settings?.revolutUsername?.trim()
  const footerRef = useRef<HTMLDivElement>(null)
  const [spacerHeight, setSpacerHeight] = useState(0)

  const remainingCents = Math.max(0, totals.balanceCents)
  const amountLabel = totals.paidCents > 0 ? 'Остатък' : 'Вашият дял'
  const amountCents = totals.paidCents > 0 ? remainingCents : totals.owedCents

  useEffect(() => {
    const footer = footerRef.current
    if (!footer) return

    const updateSpacer = () => setSpacerHeight(footer.offsetHeight)
    updateSpacer()

    const observer = new ResizeObserver(updateSpacer)
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  async function handleRevolut() {
    if (!revolutUsername || remainingCents <= 0) return
    void copyToClipboard(formatCopyAmount(remainingCents))
    window.open(buildRevolutUrl(revolutUsername, remainingCents))
    toast.success('Отворен Revolut')
  }

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
            sessionToken,
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
          await setUnits({ itemId, participantId, units: 0, sessionToken })
        } else {
          await toggleAssignment({ itemId, participantId, sessionToken })
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
      sessionToken,
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
            <Badge variant="outline">{statusLabels[totals.status]}</Badge>
          </div>

          <ParticipantBreakdownContent
            billId={billId}
            participantId={participantId}
            label={label}
            breakdownInput={breakdownInput}
            totals={totals}
            showPaymentActions={false}
            showPayActions={false}
            showStatusBadge={false}
            summaryVariant="claim-footer"
            removableItemLines
            readOnly={readOnly}
            onRemoveItem={handleRemoveItem}
            summaryFooter={
              <>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {amountLabel}
                    </p>
                    <p
                      key={amountCents}
                      className="guest-total-pulse text-lg font-semibold tabular-nums"
                    >
                      {formatEur(amountCents)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="h-11"
                    disabled={!revolutUsername || remainingCents <= 0}
                    onClick={handleRevolut}
                  >
                    <SendIcon className={ICON.button} aria-hidden />
                    Revolut
                  </Button>
                </div>
                {!revolutUsername ? (
                  <p className="text-xs text-muted-foreground">
                    Попитайте домакина за Revolut.
                  </p>
                ) : remainingCents <= 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Няма оставащо за плащане.
                  </p>
                ) : null}
              </>
            }
          />
        </div>
      </div>
    </>
  )
}
