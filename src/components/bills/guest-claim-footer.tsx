import { SendIcon, PieChartIcon, CopyIcon } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  CombinedPayChips,
  type ParticipantBalance,
} from '#/components/bills/combined-pay-chips.tsx'
import { ClaimShareDrawer } from '#/components/bills/claim-share-drawer.tsx'
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
import {
  buildRevolutPaymentNote,
  buildRevolutUrl,
} from '#/lib/payment-settings.ts'
import { copyToClipboard } from '#/lib/copy-to-clipboard.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { getCoveredParticipantIds } from '#/lib/combined-payment.ts'
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
  participantBalances?: ParticipantBalance[]
  participantLabels?: Record<string, string>
  pendingCover?: {
    payerName: string
    coveredAmountCents: number
  }
  restaurantName?: string
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
  participantBalances = [],
  participantLabels,
  pendingCover,
  restaurantName = '',
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
  const updateCovered = useMutation(api.combinedPayments.updateCovered)
  const createSolo = useMutation(api.combinedPayments.createSolo)
  const initiateTransfer = useMutation(api.combinedPayments.initiateTransfer)
  const cancelCombined = useMutation(api.combinedPayments.cancel)
  const toggleAssignment = useMutation(api.assignments.toggle)
  const leaveUnit = useMutation(api.assignments.leaveUnit)
  const revolutUsername = settings?.revolutUsername?.trim()
  const iban = settings?.iban?.trim()
  const hasRevolut = Boolean(revolutUsername)
  const hasIban = Boolean(iban)
  const hasPaymentMethod = hasRevolut || hasIban
  const [selectedCoveredIds, setSelectedCoveredIds] = useState<
    Id<'participants'>[]
  >([])
  const [isSelectingCover, setIsSelectingCover] = useState(false)

  const transferInitiated = pending?.transferInitiatedAt != null

  const remainingCents = Math.max(0, totals.balanceCents)
  const payerRemaining = remainingCents
  const selectedCoveredRemainingTotal = selectedCoveredIds.reduce(
    (sum, id) =>
      sum +
      (participantBalances.find((b) => b.participantId === id)
        ?.remainingCents ?? 0),
    0,
  )
  const isCombined = selectedCoveredIds.length > 0
  const amountLabelExisting = totals.paidCents > 0 ? 'Остатък' : 'Вашият дял'
  const amountCents = pending
    ? pending.totalCents
    : isCombined
      ? payerRemaining + selectedCoveredRemainingTotal
      : totals.paidCents > 0
        ? remainingCents
        : totals.owedCents
  const pendingCoveredIds = pending
    ? (getCoveredParticipantIds(pending) as Id<'participants'>[])
    : []
  const amountLabel =
    isCombined || pendingCoveredIds.length > 0
      ? COMBINED_PAYMENT_MESSAGES.combinedTotalLabel
      : amountLabelExisting
  const chipsDisabled =
    Boolean(pendingCover) ||
    readOnly ||
    isSelectingCover ||
    (Boolean(pending) && transferInitiated)
  const payDisabledForPayer =
    Boolean(pendingCover) || (Boolean(pending) && transferInitiated)

  useEffect(() => {
    if (pending) {
      setSelectedCoveredIds(
        getCoveredParticipantIds(pending) as Id<'participants'>[],
      )
      return
    }
    setSelectedCoveredIds([])
  }, [pending])

  const handleToggleCovered = useCallback(
    async (id: Id<'participants'>) => {
      if (pendingCover || readOnly || isSelectingCover) return
      if (pending && transferInitiated) {
        toast.error(COMBINED_PAYMENT_MESSAGES.selectionLockedAfterTransfer)
        return
      }

      const next = selectedCoveredIds.includes(id)
        ? selectedCoveredIds.filter((entry) => entry !== id)
        : [...selectedCoveredIds, id]

      setSelectedCoveredIds(next)
      setIsSelectingCover(true)
      try {
        if (next.length === 0) {
          if (pending) {
            await cancelCombined({
              billId,
              sessionToken,
              requestId: pending._id,
            })
          }
          return
        }

        if (!pending) {
          await createCombined({
            billId,
            shareToken,
            sessionToken,
            coveredParticipantIds: next,
          })
          return
        }

        await updateCovered({
          billId,
          sessionToken,
          requestId: pending._id,
          coveredParticipantIds: next,
        })
      } catch (error) {
        toast.error(getConvexErrorMessage(error))
        setSelectedCoveredIds(
          pending
            ? (getCoveredParticipantIds(pending) as Id<'participants'>[])
            : [],
        )
      } finally {
        setIsSelectingCover(false)
      }
    },
    [
      billId,
      cancelCombined,
      createCombined,
      isSelectingCover,
      pending,
      pendingCover,
      readOnly,
      selectedCoveredIds,
      sessionToken,
      shareToken,
      transferInitiated,
      updateCovered,
    ],
  )

  async function resolvePayCents(): Promise<number | null> {
    if (remainingCents <= 0 && !isCombined && !pending) return null
    if (pending) return pending.totalCents
    if (isCombined) return payerRemaining + selectedCoveredRemainingTotal
    return totals.paidCents > 0 ? remainingCents : totals.owedCents
  }

  async function recordTransferInitiated(): Promise<boolean> {
    try {
      if (!pending && !isCombined) {
        await createSolo({ billId, shareToken, sessionToken })
      } else if (pending && pending.transferInitiatedAt == null) {
        await initiateTransfer({
          billId,
          sessionToken,
          requestId: pending._id,
        })
      }
      return true
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
      return false
    }
  }

  async function handleRevolut() {
    if (!revolutUsername || (remainingCents <= 0 && !isCombined && !pending)) {
      return
    }
    const payCents = await resolvePayCents()
    if (payCents === null) return

    const recorded = await recordTransferInitiated()
    if (!recorded) return

    void copyToClipboard(formatCopyAmount(payCents))
    const payingForOthers = Boolean(pendingCoveredIds.length > 0 || isCombined)
    const participantNames = payingForOthers
      ? [
          label,
          ...selectedCoveredIds.map(
            (id) =>
              participantLabels?.[id] ??
              participantBalances.find((b) => b.participantId === id)?.name,
          ),
        ].filter((name): name is string => Boolean(name?.trim()))
      : [label]
    const note = buildRevolutPaymentNote(restaurantName, participantNames)
    window.open(buildRevolutUrl(revolutUsername, payCents, note))
    toast.success('Отворен Revolut')
  }

  async function handleCopyIban() {
    if (!iban) return
    const payCents = await resolvePayCents()
    if (payCents === null && (isCombined || pending)) return

    if (payCents !== null) {
      const recorded = await recordTransferInitiated()
      if (!recorded) return
    }

    const text =
      payCents !== null ? `${formatCopyAmount(payCents)}\n${iban}` : iban
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
      setSelectedCoveredIds([])
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  const handleRemoveItem = useCallback(
    async (itemId: Id<'items'>) => {
      if (readOnly) return
      try {
        const item = breakdownInput.items.find((entry) => entry.id === itemId)
        const myRows = breakdownInput.assignments.filter(
          (entry) =>
            entry.itemId === itemId && entry.participantId === participantId,
        )

        if (item && item.quantity > 1) {
          for (const row of myRows) {
            await leaveUnit({
              itemId,
              participantId,
              unitIndex: row.unitIndex,
              sessionToken,
            })
          }
          return
        }

        await toggleAssignment({ itemId, participantId, sessionToken })
      } catch (error) {
        toast.error(getConvexErrorMessage(error))
      }
    },
    [
      breakdownInput.assignments,
      breakdownInput.items,
      leaveUnit,
      participantId,
      readOnly,
      sessionToken,
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
      status={<Badge variant="outline">{statusLabels[totals.status]}</Badge>}
      details={
        <div className="flex flex-col gap-3">
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
            participantLabels={participantLabels}
            onRemoveItem={handleRemoveItem}
            summaryFooter={null}
          />
          <CombinedPayChips
            balances={participantBalances}
            payerParticipantId={participantId}
            selectedCoveredIds={selectedCoveredIds}
            onToggle={(id) => void handleToggleCovered(id)}
            disabled={chipsDisabled}
          />
          {pendingCover ? (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {COMBINED_PAYMENT_MESSAGES.coveredGuestHint}
            </p>
          ) : null}
          {isCombined ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Вие: {formatEur(payerRemaining)}
              </p>
              {selectedCoveredIds.map((id) => {
                const coveredBalance = participantBalances.find(
                  (b) => b.participantId === id,
                )
                if (!coveredBalance) return null
                return (
                  <p key={id} className="text-xs text-muted-foreground">
                    {coveredBalance.name}:{' '}
                    {formatEur(coveredBalance.remainingCents)}
                  </p>
                )
              })}
            </div>
          ) : null}
        </div>
      }
      summary={
        <div className="flex flex-col gap-3">
          {pending && transferInitiated ? (
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
              <p className="text-xs text-muted-foreground">{amountLabel}</p>
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
                    (remainingCents <= 0 && !isCombined && !pending) ||
                    payDisabledForPayer
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
                  disabled={payDisabledForPayer}
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
          ) : remainingCents <= 0 &&
            !isCombined &&
            !pending &&
            !pendingCover ? (
            <p className="text-xs text-muted-foreground">
              Няма оставащо за плащане.
            </p>
          ) : hasIban && !hasRevolut ? (
            <p className="text-xs text-muted-foreground">
              Копирайте IBAN за банков превод.
            </p>
          ) : null}
        </div>
      }
    />
  )
}
