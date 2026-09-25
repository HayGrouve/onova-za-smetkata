import { CheckIcon } from 'lucide-react'
import type { CoveredSeatCandidate } from '#/lib/covered-seat-candidates.ts'
import { cn } from '#/lib/utils.ts'

/** Checklist of other seats a guest can claim and pay for from this phone. */
export function CoveredSeatsPicker({
  candidates,
  selectedIds,
  onToggle,
  disabled = false,
}: {
  candidates: CoveredSeatCandidate[]
  selectedIds: string[]
  onToggle: (id: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      {candidates.map((candidate) => {
        const selected = selectedIds.includes(candidate.id)
        const unavailable = Boolean(candidate.unavailableLabel) && !selected
        return (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled || unavailable}
            onClick={() => onToggle(candidate.id)}
            className={cn(
              'tap-feedback flex h-12 items-center justify-between gap-3 rounded-lg border px-3 text-left text-base',
              selected
                ? 'border-primary/50 bg-primary/10 font-medium'
                : 'bg-background',
              unavailable && 'opacity-60',
            )}
          >
            <span className="truncate">{candidate.label}</span>
            {unavailable ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {candidate.unavailableLabel}
              </span>
            ) : (
              <span
                aria-hidden
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border',
                  selected &&
                    'border-primary bg-primary text-primary-foreground',
                )}
              >
                {selected ? <CheckIcon className="size-3.5" /> : null}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
