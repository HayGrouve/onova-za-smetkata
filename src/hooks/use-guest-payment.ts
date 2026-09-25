import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { formatCopyAmount } from '#/lib/bill-share.ts'
import { copyToClipboard } from '#/lib/copy-to-clipboard.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import {
  buildRevolutPaymentNote,
  buildRevolutUrl,
} from '#/lib/payment-settings.ts'
import { launchRevolut } from '#/lib/revolut-launch.ts'
import { getCoveredParticipantIds } from '../../shared/combined-payment'
import { COMBINED_PAYMENT_MESSAGES } from '../../shared/combined-payment-messages'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

export interface GuestParticipantBalance {
  participantId: Id<'participants'>
  name: string
  remainingCents: number
}

export interface UseGuestPaymentOptions {
  billId: Id<'bills'>
  shareToken: string
  sessionToken: string
  payerId: Id<'participants'>
  /** Covered seats this phone handles — always part of the payment. */
  coveredSeatIds: Id<'participants'>[]
  balances: GuestParticipantBalance[]
  labels: Record<string, string>
  restaurantName: string
  /** Someone else is paying for this guest, or the bill is final. */
  locked: boolean
  /** Seats another phone already claims and pays for. */
  heldElsewhereIds?: string[]
}

/**
 * Guest pay step: who this phone pays for, the amount, and the Revolut / IBAN
 * hand-off that records a request for the Host to confirm.
 */
export function useGuestPayment({
  billId,
  shareToken,
  sessionToken,
  payerId,
  coveredSeatIds,
  balances,
  labels,
  restaurantName,
  locked,
  heldElsewhereIds = [],
}: UseGuestPaymentOptions) {
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
  const cancelRequest = useMutation(api.combinedPayments.cancel)
  const [optimisticIds, setOptimisticIds] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  const remainingOf = (id: string) =>
    balances.find((balance) => balance.participantId === id)?.remainingCents ??
    0

  const transferInitiated = pending?.transferInitiatedAt != null
  const requiredCoveredIds = coveredSeatIds.filter((id) => remainingOf(id) > 0)
  const coveredIds: string[] = optimisticIds ?? [
    ...new Set<string>([
      ...requiredCoveredIds,
      ...(pending ? getCoveredParticipantIds(pending) : []),
    ]),
  ]

  const payerRemainingCents = remainingOf(payerId)
  const amountCents =
    pending && transferInitiated
      ? pending.totalCents
      : payerRemainingCents +
        coveredIds.reduce((sum, id) => sum + remainingOf(id), 0)

  const revolutUsername = settings?.revolutUsername?.trim() ?? ''
  const iban = settings?.iban?.trim() ?? ''

  /** Other guests with something left to pay that this phone may also cover. */
  const extraCandidates = balances.filter(
    (balance) =>
      balance.participantId !== payerId &&
      !coveredSeatIds.includes(balance.participantId) &&
      !heldElsewhereIds.includes(balance.participantId) &&
      balance.remainingCents > 0,
  )

  const selectionLocked = locked || busy || transferInitiated

  async function toggleExtra(id: Id<'participants'>) {
    if (selectionLocked) return
    const next = coveredIds.includes(id)
      ? coveredIds.filter((entry) => entry !== id)
      : [...coveredIds, id]
    setOptimisticIds(next)
    setBusy(true)
    try {
      if (next.length === 0) {
        if (pending) {
          await cancelRequest({ billId, sessionToken, requestId: pending._id })
        }
      } else if (pending) {
        await updateCovered({
          billId,
          sessionToken,
          requestId: pending._id,
          coveredParticipantIds: next as Id<'participants'>[],
        })
      } else {
        // Reserve the extra seats now so their phones show who is paying.
        await createCombined({
          billId,
          shareToken,
          sessionToken,
          coveredParticipantIds: next as Id<'participants'>[],
        })
      }
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setOptimisticIds(null)
      setBusy(false)
    }
  }

  /** Save the request with fresh amounts and mark the transfer as sent. */
  async function recordTransfer(): Promise<boolean> {
    if (transferInitiated) return true
    try {
      const covered = coveredIds.filter(
        (id) => remainingOf(id) > 0,
      ) as Id<'participants'>[]
      if (covered.length === 0) {
        if (pending) {
          await cancelRequest({ billId, sessionToken, requestId: pending._id })
        }
        await createSolo({ billId, shareToken, sessionToken })
        return true
      }
      const requestId = pending
        ? (
            await updateCovered({
              billId,
              sessionToken,
              requestId: pending._id,
              coveredParticipantIds: covered,
            })
          ).requestId
        : (
            await createCombined({
              billId,
              shareToken,
              sessionToken,
              coveredParticipantIds: covered,
            })
          ).requestId
      await initiateTransfer({ billId, sessionToken, requestId })
      return true
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
      return false
    }
  }

  const canPay = !locked && !transferInitiated && amountCents > 0

  const paymentNote = buildRevolutPaymentNote(
    restaurantName,
    [payerId, ...coveredIds].map((id) => labels[id] ?? ''),
  )

  function payWithRevolut() {
    if (!revolutUsername || !canPay) return
    const url = buildRevolutUrl(revolutUsername, amountCents, paymentNote)
    setBusy(true)
    void launchRevolut({
      url,
      openWindow: (targetUrl) => window.open(targetUrl),
      copyAmount: () => {
        void copyToClipboard(formatCopyAmount(amountCents))
      },
      recordTransfer,
    })
      .then((result) => {
        if (result === 'blocked') {
          toast.error('Revolut не можа да се отвори')
        } else if (result === 'opened') {
          toast.success('Отворен Revolut')
        }
      })
      .finally(() => setBusy(false))
  }

  async function copyIban() {
    if (!iban) return
    if (canPay) {
      setBusy(true)
      const recorded = await recordTransfer()
      setBusy(false)
      if (!recorded) return
    }
    const text = canPay ? `${formatCopyAmount(amountCents)}\n${iban}` : iban
    const copied = await copyToClipboard(text)
    if (copied) {
      toast.success('IBAN копиран')
    } else {
      toast.error('Неуспешно копиране')
    }
  }

  async function cancelPending() {
    if (!pending) return
    try {
      await cancelRequest({ billId, sessionToken, requestId: pending._id })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  return {
    settingsLoaded: settings !== undefined,
    hasRevolut: Boolean(revolutUsername),
    hasIban: Boolean(iban),
    pending,
    transferInitiated,
    coveredIds,
    extraCandidates,
    selectionLocked,
    amountCents,
    payerRemainingCents,
    remainingOf,
    canPay,
    busy,
    toggleExtra,
    payWithRevolut,
    copyIban,
    cancelPending,
    pendingStatusLabel: COMBINED_PAYMENT_MESSAGES.statusPending,
  }
}
