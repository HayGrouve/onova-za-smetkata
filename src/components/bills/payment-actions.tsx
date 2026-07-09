import { CheckIcon, CoinsIcon, Undo2Icon } from 'lucide-react'
import { useMutation } from 'convex/react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import type { ParticipantTotals } from '#/lib/bill-calculations.ts'
import { ICON } from '#/lib/app-icons.ts'
import { formatEur, parseEurInput } from '#/lib/format-currency.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

const paidAtFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

export interface PaymentActionsProps {
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  totals: ParticipantTotals
  payments?: Doc<'payments'>[]
}

export function PaymentActions({
  billId,
  participantId,
  label,
  totals,
  payments = [],
}: PaymentActionsProps) {
  const addPayment = useMutation(api.payments.add)
  const undoLastPayment = useMutation(api.payments.undoLast)
  const [partialAmount, setPartialAmount] = useState('')
  const [isUndoing, setIsUndoing] = useState(false)
  const remainingCents = Math.max(0, totals.balanceCents)

  const participantPayments = useMemo(
    () =>
      payments
        .filter((payment) => payment.participantId === participantId)
        .sort((a, b) => b.paidAt - a.paidAt),
    [participantId, payments],
  )

  async function handleMarkPaid() {
    if (remainingCents <= 0) return
    try {
      await addPayment({ billId, participantId, amountCents: remainingCents })
      toast.success(`${label} плати ${formatEur(remainingCents)}`)
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handlePartialPayment() {
    const amountCents = parseEurInput(partialAmount)
    if (amountCents <= 0) return
    setPartialAmount('')
    try {
      await addPayment({ billId, participantId, amountCents })
      toast.success(`${label} плати ${formatEur(amountCents)}`)
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    }
  }

  async function handleUndoLast() {
    setIsUndoing(true)
    try {
      await undoLastPayment({ billId, participantId })
      toast.success('Последното плащане е отменено')
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setIsUndoing(false)
    }
  }

  if (remainingCents <= 0 && participantPayments.length === 0) return null

  return (
    <div className="flex flex-col gap-2 pt-1">
      {participantPayments.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-md border border-border/80 bg-muted/30 px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">Плащания</p>
          <ul className="flex flex-col gap-1 text-sm">
            {participantPayments.map((payment) => (
              <li
                key={payment._id}
                className="flex items-center justify-between gap-2 tabular-nums"
              >
                <span>{formatEur(payment.amountCents)}</span>
                <span className="text-xs text-muted-foreground">
                  {paidAtFormatter.format(new Date(payment.paidAt))}
                </span>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full justify-start px-0"
            onClick={() => void handleUndoLast()}
            disabled={isUndoing}
          >
            <Undo2Icon className={ICON.button} aria-hidden />
            Отмени последно плащане
          </Button>
        </div>
      ) : null}

      {remainingCents > 0 ? (
        <>
          <Button className="h-11 w-full" onClick={handleMarkPaid}>
            <CheckIcon className={ICON.button} aria-hidden />
            Платено
          </Button>
          <div className="flex gap-2">
            <Input
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              inputMode="decimal"
              placeholder="Частична сума"
              className="h-11 min-w-0 flex-1"
            />
            <Button
              variant="outline"
              className="h-11 shrink-0"
              onClick={handlePartialPayment}
              disabled={!partialAmount.trim()}
            >
              <CoinsIcon className={ICON.button} aria-hidden />
              Плати
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
