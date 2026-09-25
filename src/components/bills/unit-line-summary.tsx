import { formatEur } from '#/lib/format-currency.ts'
import { formatShareParticipantCount } from '../../../shared/guest-share-preview.ts'

export interface UnitLineSummaryProps {
  unitTitle: string
  unitPriceCents: number
  /** Everyone on the Unit, as display labels. */
  assigneeLabels: string[]
}

/** One Unit in the Host's per-unit dialog: title, price, and who has it. */
export function UnitLineSummary({
  unitTitle,
  unitPriceCents,
  assigneeLabels,
}: UnitLineSummaryProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{unitTitle}</p>
        <p className="money shrink-0 text-sm font-medium">
          {formatEur(unitPriceCents)}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        {assigneeLabels.length === 0
          ? 'Празна бройка'
          : assigneeLabels.length === 1
            ? assigneeLabels[0]
            : `Споделено от ${assigneeLabels.join(', ')} (${formatShareParticipantCount(assigneeLabels.length)})`}
      </p>
    </div>
  )
}
