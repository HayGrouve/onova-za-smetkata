import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import { SeatAvatar, useSeatLookup } from '#/components/receipt/seats.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { getConvexErrorMessage } from '#/lib/convex-error.ts'
import { getCoveredParticipantIds } from '../../../shared/combined-payment.ts'
import { buildParticipantLabels, joinLabels } from '#/lib/participant-labels.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { COMBINED_PAYMENT_MESSAGES } from '../../../shared/combined-payment-messages'

function formatCombinedCopy(
  payerName: string,
  coveredNames: string[],
  totalCents: number,
): { banner: string; confirmPrompt: string; toast: string } {
  const allNames = [payerName, ...coveredNames]
  const joined = joinLabels(allNames)

  if (coveredNames.length === 0) {
    return {
      banner: COMBINED_PAYMENT_MESSAGES.soloHostBanner
        .replace('{payer}', payerName)
        .replace('{total}', formatEur(totalCents)),
      confirmPrompt: COMBINED_PAYMENT_MESSAGES.soloHostConfirmPrompt.replace(
        '{payer}',
        payerName,
      ),
      toast: `${payerName} е маркиран като платен`,
    }
  }

  if (coveredNames.length === 1) {
    const coveredName = coveredNames[0]
    return {
      banner: COMBINED_PAYMENT_MESSAGES.hostBanner
        .replaceAll('{payer}', payerName)
        .replace('{total}', formatEur(totalCents))
        .replace('{covered}', coveredName),
      confirmPrompt: COMBINED_PAYMENT_MESSAGES.hostConfirmPrompt
        .replace('{payer}', payerName)
        .replace('{covered}', coveredName),
      toast: `${payerName} и ${coveredName} са маркирани като платени`,
    }
  }

  return {
    banner: `${payerName} плати ${formatEur(totalCents)} за ${joined}`,
    confirmPrompt: `Маркира ${joined} като платени?`,
    toast: `${joined} са маркирани като платени`,
  }
}

/**
 * „Деси отбеляза превод“: guests who opened Revolut or copied the IBAN wait
 * here for the Host. One tap confirms the whole request (payer and Covered
 * seats); a mistake is undone from that person's slip.
 */
export function CombinedPaymentBanner({ billId }: { billId: Id<'bills'> }) {
  const pending = useQuery(api.combinedPayments.listPendingForBill, { billId })
  const confirmMutation = useMutation(api.combinedPayments.confirm)
  const rejectMutation = useMutation(api.combinedPayments.reject)
  const { confirm: confirmAction } = useConfirmAction()
  const bill = useQuery(api.bills.get, { billId })
  const seatOf = useSeatLookup()
  const [activeRequestId, setActiveRequestId] =
    useState<Id<'combinedPaymentRequests'> | null>(null)

  const labels = useMemo(
    () => (bill ? buildParticipantLabels(bill.participants) : {}),
    [bill],
  )

  if (!pending?.length) return null

  async function handleConfirm(
    requestId: Id<'combinedPaymentRequests'>,
    copy: ReturnType<typeof formatCombinedCopy>,
  ) {
    setActiveRequestId(requestId)
    try {
      await confirmMutation({ billId, requestId })
      toast.success(copy.toast)
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setActiveRequestId(null)
    }
  }

  async function handleReject(requestId: Id<'combinedPaymentRequests'>) {
    const confirmed = await confirmAction({
      title: 'Не виждате превода?',
      description:
        'Гостът ще види, че плащането не е потвърдено, и може да опита отново.',
      confirmLabel: COMBINED_PAYMENT_MESSAGES.reject,
    })
    if (!confirmed) return
    setActiveRequestId(requestId)
    try {
      await rejectMutation({ billId, requestId })
      toast.success('Заявката е отхвърлена')
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setActiveRequestId(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {pending.map((request) => {
        const payerName = labels[request.payerParticipantId] ?? 'Участник'
        const coveredIds = getCoveredParticipantIds(request)
        const coveredNames = coveredIds.map((id) => labels[id] ?? 'Участник')
        const copy = formatCombinedCopy(
          payerName,
          coveredNames,
          request.totalCents,
        )
        const isBusy = activeRequestId === request._id
        const seat = seatOf(request.payerParticipantId)

        return (
          <div
            key={request._id}
            className="rounded-[22px] bg-table-2 px-3 py-2.5 text-on-table"
          >
            <div className="flex items-center gap-2.5 text-[12px]">
              {seat ? <SeatAvatar seat={seat} size="sm" /> : null}
              <span className="min-w-0 flex-1 leading-snug">{copy.banner}</span>
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                disabled={isBusy}
                onClick={() => void handleConfirm(request._id, copy)}
              >
                {COMBINED_PAYMENT_MESSAGES.confirm}
              </Button>
            </div>
            <button
              type="button"
              className="mt-1 ml-[42px] min-h-9 text-[11px] text-on-table-muted underline decoration-dotted decoration-2 underline-offset-4"
              disabled={isBusy}
              onClick={() => void handleReject(request._id)}
            >
              Не виждам превода
            </button>
          </div>
        )
      })}
    </div>
  )
}
