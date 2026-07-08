import type { ParticipantTotals } from '#/lib/bill-calculations.ts'

export interface PaymentProgressParticipant {
  id: string
  sortOrder: number
}

export interface PaymentProgressProps {
  participants: PaymentProgressParticipant[]
  byParticipant: Record<string, ParticipantTotals>
}

export function PaymentProgress({
  participants,
  byParticipant,
}: PaymentProgressProps) {
  if (participants.length === 0) return null

  const totalCount = participants.length
  const paidCount = participants.filter(
    (p) => byParticipant[p.id].status === 'paid',
  ).length
  const progressPercent = (paidCount / totalCount) * 100

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {paidCount} от {totalCount} платени
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={paidCount}
        aria-valuemin={0}
        aria-valuemax={totalCount}
        aria-label={`${paidCount} от ${totalCount} платени`}
      >
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  )
}
