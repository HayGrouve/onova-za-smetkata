import type { ReactNode } from 'react'
import { formatEur } from '#/lib/format-currency.ts'
import { formatShareParticipantCount } from '#/lib/guest-share-preview.ts'

export interface UnitLineSummaryProps {
  unitTitle: string
  unitPriceCents: number
  isEmpty: boolean
  otherClaimantLabels: string[]
  /** Guest self-claim: whether the current participant joined this Unit. */
  joined?: boolean
  shareCents?: number
  showSharePreview?: boolean
  actionHint?: ReactNode
  children?: ReactNode
}

export function UnitLineSummary({
  unitTitle,
  unitPriceCents,
  isEmpty,
  otherClaimantLabels,
  joined = false,
  shareCents,
  showSharePreview = true,
  actionHint,
  children,
}: UnitLineSummaryProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium">{unitTitle}</p>
        <p className="money shrink-0 text-sm font-medium">
          {formatEur(unitPriceCents)}
        </p>
      </div>
      {joined ? (
        <>
          <p className="text-xs font-medium text-primary">✓ Ваше</p>
          {otherClaimantLabels.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Споделено с {otherClaimantLabels.join(', ')} (
              {formatShareParticipantCount(otherClaimantLabels.length)})
            </p>
          ) : null}
          {showSharePreview && shareCents !== undefined ? (
            <p className="text-xs text-muted-foreground">
              Вашият дял: {formatEur(shareCents)}
            </p>
          ) : null}
          {actionHint}
        </>
      ) : (
        <>
          {isEmpty ? (
            <p className="text-xs text-muted-foreground">Празна бройка</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Споделено с {otherClaimantLabels.join(', ')} (
                {formatShareParticipantCount(otherClaimantLabels.length)})
              </p>
              {showSharePreview && shareCents !== undefined ? (
                <p className="text-xs text-muted-foreground">
                  Вашият дял: {formatEur(shareCents)}
                </p>
              ) : null}
            </>
          )}
          {actionHint}
        </>
      )}
      {children}
    </div>
  )
}
