import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import type { ParticipantTotals } from '#/lib/bill-calculations.ts'
import { formatEur, parseEurInput } from '#/lib/format-currency.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export interface PaymentActionsProps {
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  totals: ParticipantTotals
}

export function PaymentActions({
  billId,
  participantId,
  label,
  totals,
}: PaymentActionsProps) {
  const addPayment = useMutation(api.payments.add)
  const [partialAmount, setPartialAmount] = useState('')
  const remainingCents = Math.max(0, totals.balanceCents)

  async function handleMarkPaid() {
    if (remainingCents <= 0) return
    await addPayment({ billId, participantId, amountCents: remainingCents })
    toast.success(`${label} плати ${formatEur(remainingCents)}`)
  }

  async function handlePartialPayment() {
    const amountCents = parseEurInput(partialAmount)
    if (amountCents <= 0) return
    setPartialAmount('')
    await addPayment({ billId, participantId, amountCents })
    toast.success(`${label} плати ${formatEur(amountCents)}`)
  }

  if (remainingCents <= 0) return null

  return (
    <div className="flex flex-col gap-2 pt-1">
      <Button className="h-11 w-full" onClick={handleMarkPaid}>
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
          Плати
        </Button>
      </div>
    </div>
  )
}
