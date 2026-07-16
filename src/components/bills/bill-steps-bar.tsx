import { CheckIcon } from 'lucide-react'
import type { BillStepCompletion } from '#/lib/bill-step-completion.ts'
import { cn } from '#/lib/utils.ts'

export type BillStep = 1 | 2 | 3 | 4

export const BILL_STEP_LABELS = [
  'Бележка',
  'Участници',
  'Разпределение',
  'Преглед',
] as const

export interface BillStepsBarProps {
  step: BillStep
  completed: BillStepCompletion
  onStepSelect: (step: BillStep) => void
}

export function BillStepsBar({
  step,
  completed,
  onStepSelect,
}: BillStepsBarProps) {
  return (
    <div className="sticky-surface sticky top-14 z-30 border-b">
      <div className="mx-auto flex max-w-lg flex-col gap-1.5 px-4 py-2">
        <div className="flex gap-1.5">
          {BILL_STEP_LABELS.map((label, i) => {
            const s = (i + 1) as BillStep
            const done = completed[s]
            const isCurrent = s === step
            const completionLabel = done ? 'завършена' : 'незавършена'
            return (
              <button
                key={label}
                type="button"
                aria-label={`Стъпка ${s}: ${label}, ${completionLabel}`}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onStepSelect(s)}
                className="flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1"
              >
                <span
                  className={cn(
                    'flex h-3.5 w-full items-center justify-center',
                    !done && 'invisible',
                  )}
                  aria-hidden
                >
                  <CheckIcon
                    className="size-3.5 text-success"
                    strokeWidth={2.5}
                  />
                </span>
                <span
                  className={cn(
                    'h-1.5 w-full rounded-full transition-colors',
                    isCurrent
                      ? 'bg-primary'
                      : done
                        ? 'bg-success'
                        : 'bg-border',
                  )}
                />
              </button>
            )
          })}
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          Стъпка {step} · {BILL_STEP_LABELS[step - 1]}
        </p>
      </div>
    </div>
  )
}
