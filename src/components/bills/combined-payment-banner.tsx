import { ClockIcon } from 'lucide-react'
import { useMutation, useQuery } from 'convex/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { getCoveredParticipantIds } from '#/lib/combined-payment.ts'
import { ICON } from '#/lib/app-icons.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { COMBINED_PAYMENT_MESSAGES } from '../../../shared/combined-payment-messages'

function joinParticipantNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} и ${names[1]}`
  return `${names.slice(0, -1).join(', ')} и ${names.at(-1)}`
}

function formatCombinedCopy(
  payerName: string,
  coveredNames: string[],
  totalCents: number,
): { banner: string; confirmPrompt: string; toast: string } {
  const allNames = [payerName, ...coveredNames]
  const joined = joinParticipantNames(allNames)

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

  async function handleConfirm(
    requestId: Id<'combinedPaymentRequests'>,
    copy: ReturnType<typeof formatCombinedCopy>,
  ) {
    const confirmed = await confirmAction({
      title: copy.confirmPrompt,
      confirmLabel: COMBINED_PAYMENT_MESSAGES.confirm,
      variant: 'default',
    })
    if (!confirmed) return

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
        const payerName = labels[request.payerParticipantId]
        const coveredIds = getCoveredParticipantIds(request)
        const coveredNames = coveredIds.map((id) => labels[id])
        const copy = formatCombinedCopy(
          payerName,
          coveredNames,
          request.totalCents,
        )
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
                <span>{copy.banner}</span>
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="h-11 flex-1 bg-success text-success-foreground hover:bg-success/90"
                  disabled={isBusy}
                  onClick={() => void handleConfirm(request._id, copy)}
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
