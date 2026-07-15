// src/components/bills/combined-pay-chips.tsx
import { Button } from '#/components/ui/button.tsx'
import { cn } from '#/lib/utils.ts'
import type { Id } from '../../../convex/_generated/dataModel'
import { COMBINED_PAYMENT_MESSAGES } from '../../../shared/combined-payment-messages'

export type ParticipantBalance = {
  participantId: Id<'participants'>
  name: string
  remainingCents: number
}

export function CombinedPayChips({
  balances,
  payerParticipantId,
  selectedCoveredId,
  onSelect,
  disabled,
}: {
  balances: ParticipantBalance[]
  payerParticipantId: Id<'participants'>
  selectedCoveredId: Id<'participants'> | null
  onSelect: (id: Id<'participants'> | null) => void
  disabled?: boolean
}) {
  const others = balances.filter(
    (b) =>
      b.participantId !== payerParticipantId && b.remainingCents > 0,
  )
  if (others.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {COMBINED_PAYMENT_MESSAGES.payForLabel}
      </p>
      <div className="flex flex-wrap gap-2">
        {others.map((p) => {
          const selected = selectedCoveredId === p.participantId
          return (
            <Button
              key={p.participantId}
              type="button"
              variant={selected ? 'default' : 'outline'}
              size="sm"
              className="h-9"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() =>
                onSelect(selected ? null : p.participantId)
              }
            >
              {p.name}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
