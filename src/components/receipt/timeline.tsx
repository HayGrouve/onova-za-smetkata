import { CheckIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'

/** The three phases a bill moves through. Host editor steps map onto them. */
export type Phase = 'assemble' | 'table' | 'settle'

export const PHASES: Array<{ key: Phase; label: string }> = [
  { key: 'assemble', label: 'Сглобяване' },
  { key: 'table', label: 'На масата' },
  { key: 'settle', label: 'Разплащане' },
]

/** Steps 1 and 2 (Сметка, Участници) are both Сглобяване. */
export function phaseForStep(step: 1 | 2 | 3 | 4): Phase {
  if (step === 4) return 'settle'
  if (step === 3) return 'table'
  return 'assemble'
}

export function stepForPhase(phase: Phase): 1 | 3 | 4 {
  if (phase === 'settle') return 4
  if (phase === 'table') return 3
  return 1
}

export function Timeline({
  phase,
  onPhase,
  final,
  className,
}: {
  phase: Phase
  onPhase?: (phase: Phase) => void
  final?: boolean
  className?: string
}) {
  const current = PHASES.findIndex((p) => p.key === phase)
  return (
    <ol
      className={cn('flex items-stretch gap-1', className)}
      aria-label="Етап на сметката"
    >
      {PHASES.map((p, index) => {
        const done = final || index < current
        const active = !final && index === current
        const inner = (
          <>
            <span
              className={cn(
                'mb-1.5 block h-[3px] w-full rounded-full',
                active ? 'bg-stamp' : done ? 'bg-on-table' : 'bg-table-3',
              )}
            />
            <span
              className={cn(
                'flex w-full min-w-0 items-center gap-1 leading-tight',
                active
                  ? 'font-display text-[10px] font-bold text-on-table sm:text-[11px]'
                  : 'text-[11px] text-on-table-muted',
              )}
            >
              {done ? (
                <CheckIcon
                  className="size-3 shrink-0"
                  strokeWidth={2.25}
                  aria-hidden
                />
              ) : null}
              <span className="min-w-0 truncate">{p.label}</span>
            </span>
          </>
        )
        return (
          <li
            key={p.key}
            className="min-w-0 flex-1"
            aria-current={active ? 'step' : undefined}
          >
            {onPhase ? (
              <button
                type="button"
                onClick={() => onPhase(p.key)}
                className="flex min-h-11 w-full min-w-0 flex-col items-start justify-center text-left"
              >
                {inner}
              </button>
            ) : (
              <div className="flex min-h-11 min-w-0 flex-col justify-center">
                {inner}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
