import { SendIcon, PieChartIcon, CopyIcon } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  CombinedPayChips,
  type ParticipantBalance,
} from '#/components/bills/combined-pay-chips.tsx'
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
import { COMBINED_PAYMENT_MESSAGES } from '../../../shared/combined-payment-messages'

const statusLabels: Record<PaymentStatus, string> = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
}

export interface GuestClaimFooterProps {
  billId: Id<'bills'>
  shareToken: string
  participantId: Id<'participants'>
  sessionToken: string
  label: string
  breakdownInput: BillBreakdownInput
  totals: ParticipantTotals
  participantBalances: ParticipantBalance[]
  readOnly?: boolean
}

export function GuestClaimFooter({
  billId,
  shareToken,
  participantId,
  sessionToken,
  label,
  breakdownInput,
  totals,
  participantBalances,
  readOnly = false,
}: GuestClaimFooterProps) {
  const settings = useQuery(api.paymentSettings.getForGuest, {
    billId,
    shareToken,
  })
  const pending = useQuery(api.combinedPayments.getPendingForGuest, {
    billId,
    shareToken,
    sessionToken,
  })
  const createCombined = useMutation(api.combinedPayments.create)
  const cancelCombined = useMutation(api.combinedPayments.cancel)
  const toggleAssignment = useMutation(api.assignments.toggle)
  const setUnits = useMutation(api.assignments.setUnits)
  const revolutUsername = settings?.revolutUsername?.trim()
  const iban = settings?.iban?.trim()
  const hasRevolut = Boolean(revolutUsername)
  const hasIban = Boolean(iban)
  const hasPaymentMethod = hasRevolut || hasIban
  const footerRef = useRef<HTMLDivElement>(null)
  const [spacerHeight, setSpacerHeight] = useState(0)
  const [selectedCoveredId, setSelectedCoveredId] =
    useState<Id<'participants'> | null>(null)

  const remainingCents = Math.max(0, totals.balanceCents)
  const payerRemaining = remainingCents
  const coveredRemaining = selectedCoveredId
    ? (participantBalances.find((b) => b.participantId === selectedCoveredId)
        ?.remainingCents ?? 0)
    : 0
  const isCombined = Boolean(selectedCoveredId) && coveredRemaining > 0
  const amountLabelExisting =
    totals.paidCents > 0 ? 'Остатък' : 'Вашият дял'
  const amountCents = pending
    ? pending.totalCents
    : isCombined
      ? payerRemaining + coveredRemaining
      : totals.paidCents > 0
        ? remainingCents
        : totals.owedCents
  const amountLabel =
    isCombined || pending
      ? COMBINED_PAYMENT_MESSAGES.combinedTotalLabel
      : amountLabelExisting
  const chipsDisabled = Boolean(pending) || readOnly
  const coveredName = selectedCoveredId
    ? participantBalances.find((b) => b.participantId === selectedCoveredId)
        ?.name
    : null

  useEffect(() => {
    if (pending) {
      setSelectedCoveredId(pending.coveredParticipantId)
    }
  }, [pending])

  useEffect(() => {
    const footer = footerRef.current
    if (!footer) return

    const updateSpacer = () => setSpacerHeight(footer.offsetHeight)
    updateSpacer()

    const observer = new ResizeObserver(updateSpacer)
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  async function resolvePayCents(): Promise<number | null> {
    if (remainingCents <= 0 && !isCombined && !pending) return null
    let payCents = amountCents
    if (isCombined && !pending) {
      try {
        const result = await createCombined({
          billId,
          shareToken,
          sessionToken,
          coveredParticipantId: selectedCoveredId!,
        })
        payCents = result.totalCents
      } catch (error) {
        toast.error(getConvexErrorMessage(error))
        return null
      }
    } else if (pending) {
      payCents = pending.totalCents
    }
    return payCents
  }

  async function handleRevolut() {
    if (!revolutUsername || (remainingCents <= 0 && !isCombined && !pending)) {
      return
    }
    const payCents = await resolvePayCents()
    if (payCents === null) return
    void copyToClipboard(formatCopyAmount(payCents))
    window.open(buildRevolutUrl(revolutUsername, payCents))
    toast.success('Отворен Revolut')
  }

  async function handleCopyIban() {
    if (!iban) return
    const payCents = await resolvePayCents()
    if (payCents === null && (isCombined || pending)) return
    const text =
      payCents !== null
        ? `${formatCopyAmount(payCents)}\n${iban}`
        : iban
    const copied = await copyToClipboard(text)
    if (copied) {
      toast.success('IBAN копиран')
    } else {
      toast.error('Неуспешно копиране')
    }
  }

  async function handleCancelPending() {
    if (!pending) return
    try {
      await cancelCombined({
        billId,
        sessionToken,
        requestId: pending._id,
      })
      setSelectedCoveredId(null)
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
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
                <CombinedPayChips
                  balances={participantBalances}
                  payerParticipantId={participantId}
                  selectedCoveredId={selectedCoveredId}
                  onSelect={setSelectedCoveredId}
                  disabled={chipsDisabled}
                />
                {isCombined && coveredName ? (
                  <p className="text-xs text-muted-foreground">
                    {coveredName}: {formatEur(coveredRemaining)}
                  </p>
                ) : null}
                {pending ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-amber-600 dark:text-amber-500">
                      {COMBINED_PAYMENT_MESSAGES.statusPending}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2 text-xs"
                      onClick={() => void handleCancelPending()}
                    >
                      {COMBINED_PAYMENT_MESSAGES.cancelPending}
                    </Button>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {amountLabel}
                    </p>
                    <p
                      key={amountCents}
                      className="guest-total-pulse money text-lg font-semibold"
                    >
                      {formatEur(amountCents)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {hasRevolut ? (
                      <Button
                        type="button"
                        className="h-11"
                        disabled={
                          (remainingCents <= 0 && !isCombined) ||
                          Boolean(pending)
                        }
                        onClick={() => void handleRevolut()}
                      >
                        <SendIcon className={ICON.button} aria-hidden />
                        Revolut
                      </Button>
                    ) : null}
                    {hasIban ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={() => void handleCopyIban()}
                      >
                        <CopyIcon className={ICON.button} aria-hidden />
                        IBAN
                      </Button>
                    ) : null}
                  </div>
                </div>
                {!hasPaymentMethod ? (
                  <p className="text-xs text-muted-foreground">
                    Попитайте домакина за Revolut или банков превод.
                  </p>
                ) : remainingCents <= 0 && !isCombined && !pending ? (
                  <p className="text-xs text-muted-foreground">
                    Няма оставащо за плащане.
                  </p>
                ) : hasIban && !hasRevolut ? (
                  <p className="text-xs text-muted-foreground">
                    Копирайте IBAN за банков превод.
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
