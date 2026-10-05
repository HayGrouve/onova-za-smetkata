import { LeaderRow } from '#/components/receipt/paper.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import type { BillBreakdownInput } from '../../../shared/bill-calculations.ts'
import { buildParticipantShareLines } from '../../../shared/participant-share-view.ts'

/** One person's part of the receipt as printed lines: items, shares, tip. */
export function ShareLines({
  breakdownInput,
  participantId,
  labels,
  emptyText = 'Още нищо не е отбелязано.',
}: {
  breakdownInput: BillBreakdownInput
  participantId: string
  labels: Record<string, string>
  emptyText?: string
}) {
  const lines = buildParticipantShareLines({
    breakdownInput,
    participantId,
    participantLabels: labels,
  })
  if (lines.length === 0) {
    return <p className="text-[12px] text-ink-muted">{emptyText}</p>
  }
  return (
    <div className="space-y-0.5 text-[12px]">
      {lines.map((line) => {
        const detail = [line.unitsText, line.sharedText]
          .filter(Boolean)
          .join(', ')
        return (
          <LeaderRow
            key={line.key}
            label={
              <>
                {line.label}
                {detail ? (
                  <span className="text-ink-muted"> ({detail})</span>
                ) : null}
              </>
            }
            value={formatEur(line.amountCents)}
          />
        )
      })}
    </div>
  )
}
