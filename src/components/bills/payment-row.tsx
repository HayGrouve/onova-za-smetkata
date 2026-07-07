import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import type {
  ParticipantTotals,
  PaymentStatus,
} from '#/lib/bill-calculations.ts'
import { formatEur, parseEurInput } from '#/lib/format-currency.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

const statusLabels: Record<PaymentStatus, string> = {
  unpaid: 'неплатено',
  partial: 'частично',
  paid: 'платено',
}

const statusVariants: Record<
  PaymentStatus,
  'outline' | 'secondary' | 'default'
> = {
  unpaid: 'outline',
  partial: 'secondary',
  paid: 'default',
}

export interface PaymentRowProps {
  billId: Id<'bills'>
  participantId: Id<'participants'>
  label: string
  totals: ParticipantTotals
}

export function PaymentRow({
  billId,
  participantId,
  label,
  totals,
}: PaymentRowProps) {
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

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{label}</p>
        <Badge variant={statusVariants[totals.status]}>
          {statusLabels[totals.status]}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
        <div>
          <p className="text-xs">Дължи</p>
          <p className="tabular-nums text-foreground">
            {formatEur(totals.owedCents)}
          </p>
        </div>
        <div>
          <p className="text-xs">Платено</p>
          <p className="tabular-nums text-foreground">
            {formatEur(totals.paidCents)}
          </p>
        </div>
        <div>
          <p className="text-xs">Остатък</p>
          <p className="tabular-nums text-foreground">
            {formatEur(remainingCents)}
          </p>
        </div>
      </div>
      {remainingCents > 0 && (
        <div className="flex gap-2 pt-1">
          <Button className="h-11 flex-1" onClick={handleMarkPaid}>
            Платено
          </Button>
          <Input
            value={partialAmount}
            onChange={(e) => setPartialAmount(e.target.value)}
            inputMode="decimal"
            placeholder="Частична сума"
            className="h-11 w-32"
          />
          <Button
            variant="outline"
            className="h-11"
            onClick={handlePartialPayment}
            disabled={!partialAmount.trim()}
          >
            Плати
          </Button>
        </div>
      )}
    </div>
  )
}
