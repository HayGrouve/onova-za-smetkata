import { ClockIcon } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { ICON } from '#/lib/app-icons.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { COMBINED_PAYMENT_MESSAGES } from '../../../shared/combined-payment-messages'

function formatHostBanner(
  payerName: string,
  coveredName: string,
  totalCents: number,
): string {
  return COMBINED_PAYMENT_MESSAGES.hostBanner
    .replaceAll('{payer}', payerName)
    .replace('{total}', formatEur(totalCents))
    .replace('{covered}', coveredName)
}

function formatHostConfirmPrompt(payerName: string, coveredName: string): string {
  return COMBINED_PAYMENT_MESSAGES.hostConfirmPrompt
    .replace('{payer}', payerName)
    .replace('{covered}', coveredName)
}

function formatSoloHostBanner(payerName: string, totalCents: number): string {
  return COMBINED_PAYMENT_MESSAGES.soloHostBanner
    .replace('{payer}', payerName)
    .replace('{total}', formatEur(totalCents))
}

function formatSoloHostConfirmPrompt(payerName: string): string {
  return COMBINED_PAYMENT_MESSAGES.soloHostConfirmPrompt.replace(
    '{payer}',
    payerName,
  )
}

export function CombinedPaymentBanner({ billId }: { billId: Id<'bills'> }) {
  const pending = useQuery(api.combinedPayments.listPendingForBill, { billId })
  const confirmMutation = useMutation(api.combinedPayments.confirm)
  const rejectMutation = useMutation(api.combinedPayments.reject)
  const { confirm: confirmAction } = useConfirmAction()
  const bill = useQuery(api.bills.get, { billId })
  const [activeRequestId, setActiveRequestId] =
    useState<Id<'combinedPaymentRequests'> | null>(null)

  const labels = useMemo(
    () => (bill ? buildParticipantLabels(bill.participants) : {}),
    [bill],
  )

  if (!pending?.length) return null

  async function handleConfirmCombined(
    requestId: Id<'combinedPaymentRequests'>,
    payerName: string,
    coveredName: string,
  ) {
    const confirmed = await confirmAction({
      title: formatHostConfirmPrompt(payerName, coveredName),
      confirmLabel: COMBINED_PAYMENT_MESSAGES.confirm,
      variant: 'default',
    })
    if (!confirmed) return

    setActiveRequestId(requestId)
    try {
      await confirmMutation({ billId, requestId })
      toast.success(`${payerName} и ${coveredName} са маркирани като платени`)
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setActiveRequestId(null)
    }
  }

  async function handleConfirmSolo(
    requestId: Id<'combinedPaymentRequests'>,
    payerName: string,
  ) {
    const confirmed = await confirmAction({
      title: formatSoloHostConfirmPrompt(payerName),
      confirmLabel: COMBINED_PAYMENT_MESSAGES.confirm,
      variant: 'default',
    })
    if (!confirmed) return

    setActiveRequestId(requestId)
    try {
      await confirmMutation({ billId, requestId })
      toast.success(`${payerName} е маркиран като платен`)
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setActiveRequestId(null)
    }
  }

  async function handleReject(requestId: Id<'combinedPaymentRequests'>) {
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
        const payerName =
          labels[request.payerParticipantId] ??
          bill?.participants.find((p) => p._id === request.payerParticipantId)
            ?.name ??
          'Участник'
        const isSolo = !request.coveredParticipantId
        const coveredName = isSolo
          ? null
          : (labels[request.coveredParticipantId] ??
            bill?.participants.find(
              (p) => p._id === request.coveredParticipantId,
            )?.name ??
            'Участник')
        const isBusy = activeRequestId === request._id

        return (
          <Card
            key={request._id}
            className="border-accent-foreground/40 bg-accent/40"
          >
            <CardContent className="flex flex-col gap-3 pt-4">
              <p className="flex items-start gap-2 text-sm">
                <ClockIcon
                  className={`${ICON.section} mt-0.5 shrink-0 text-amber-600 dark:text-amber-500`}
                  aria-hidden
                />
                <span>
                  {isSolo
                    ? formatSoloHostBanner(payerName, request.totalCents)
                    : formatHostBanner(
                        payerName,
                        coveredName!,
                        request.totalCents,
                      )}
                </span>
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="h-11 flex-1 bg-success text-success-foreground hover:bg-success/90"
                  disabled={isBusy}
                  onClick={() =>
                    isSolo
                      ? void handleConfirmSolo(request._id, payerName)
                      : void handleConfirmCombined(
                          request._id,
                          payerName,
                          coveredName!,
                        )
                  }
                >
                  {COMBINED_PAYMENT_MESSAGES.confirm}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1"
                  disabled={isBusy}
                  onClick={() => void handleReject(request._id)}
                >
                  {COMBINED_PAYMENT_MESSAGES.reject}
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
