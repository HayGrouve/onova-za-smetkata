import { useMutation, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { copyToClipboard } from '#/lib/copy-to-clipboard.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { getConvexErrorMessage } from '#/lib/convex-error.ts'
import {
  buildRevolutPaymentNote,
  buildRevolutUrl,
} from '#/lib/payment-settings.ts'
import { launchRevolut } from '#/lib/revolut-launch.ts'
import { getCoveredParticipantIds } from '../../shared/combined-payment'
import { formatEurInput } from '../../shared/validation/eur'
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
    sessionToken,
  })
  const reserve = useMutation(api.combinedPayments.reserve)
  const sendTransfer = useMutation(api.combinedPayments.recordTransfer)
  const cancelRequest = useMutation(api.combinedPayments.cancel)
  /** Other Guests picked while the server is still saving the pick. */
  const [optimisticIds, setOptimisticIds] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)

  const remainingOf = (id: string) =>
    balances.find((balance) => balance.participantId === id)?.remainingCents ??
    0

  const transferInitiated = pending?.transferInitiatedAt != null
  // The server always adds this phone's Covered seats that still owe; the
  // phone only picks the other Guests.
  const otherIds: string[] =
    optimisticIds ??
    (pending ? getCoveredParticipantIds(pending) : []).filter(
      (id) => !coveredSeatIds.includes(id as Id<'participants'>),
    )
  const coveredIds: string[] = [
    ...new Set<string>([
      ...coveredSeatIds.filter((id) => remainingOf(id) > 0),
      ...otherIds,
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
    const next = otherIds.includes(id)
      ? otherIds.filter((entry) => entry !== id)
      : [...otherIds, id]
    setOptimisticIds(next)
    setBusy(true)
    try {
      // Reserve the picked seats now so their phones show who is paying.
      await reserve({
        billId,
        sessionToken,
        otherParticipantIds: next as Id<'participants'>[],
      })
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setOptimisticIds(null)
      setBusy(false)
    }
  }

  /** The server prices the request afresh and marks it Sent in one step. */
  async function recordTransfer(): Promise<boolean> {
    if (transferInitiated) return true
    try {
      await sendTransfer({
        billId,
        sessionToken,
        otherParticipantIds: otherIds as Id<'participants'>[],
      })
      return true
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
      return false
    }
  }

  const canPay = !locked && !transferInitiated && amountCents > 0
  // Still useful after „Копирай IBAN“ records the transfer: the bank app
  // needs the amount too, and copying it records nothing.
  const canCopyAmount = !locked && amountCents > 0

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
        void copyToClipboard(formatEurInput(amountCents))
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
    // Only the IBAN: a bank's IBAN field does not take "amount, newline, IBAN".
    const copied = await copyToClipboard(iban)
    if (copied) {
      toast.success('IBAN е копиран')
    } else {
      toast.error('Неуспешно копиране')
    }
  }

  /** Copies just the amount for the bank's amount field; records nothing. */
  async function copyAmount() {
    if (!canCopyAmount) return
    const copied = await copyToClipboard(formatEurInput(amountCents))
    if (copied) {
      toast.success(`Сумата ${formatEur(amountCents)} е копирана`)
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
    iban,
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
    copyAmount,
    canCopyAmount,
    cancelPending,
    pendingStatusLabel: COMBINED_PAYMENT_MESSAGES.statusPending,
  }
}
