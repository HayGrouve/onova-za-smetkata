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
  onStepSelect: (step: BillStep) => void
}

export function BillStepsBar({ step, onStepSelect }: BillStepsBarProps) {
  return (
    <div className="sticky-surface sticky top-14 z-30 border-b">
      <div className="mx-auto flex max-w-lg flex-col gap-1.5 px-4 py-2">
        <div className="flex gap-1.5">
          {BILL_STEP_LABELS.map((label, i) => {
            const s = (i + 1) as BillStep
            return (
              <button
                key={label}
                type="button"
                aria-label={`Стъпка ${s}: ${label}`}
                aria-current={s === step ? 'step' : undefined}
                onClick={() => onStepSelect(s)}
                className={cn(
                  'h-1.5 flex-1 cursor-pointer rounded-full transition-colors',
                  s <= step ? 'bg-primary' : 'bg-border',
                )}
              />
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
