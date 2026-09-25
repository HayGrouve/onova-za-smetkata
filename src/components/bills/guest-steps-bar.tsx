import { cn } from '#/lib/utils.ts'

const GUEST_STEP_LABELS = ['Име', 'Артикули', 'Плащане'] as const

export type GuestStep = 1 | 2 | 3

/** Guest journey progress: pick a name → mark items → pay. */
export function GuestStepsBar({ step }: { step: GuestStep }) {
  return (
    <nav aria-label="Стъпки" className="flex flex-col gap-1.5">
      <ol className="flex gap-1.5">
        {GUEST_STEP_LABELS.map((label, index) => {
          const current = (index + 1) as GuestStep
          const done = current < step
          const isCurrent = current === step
          return (
            <li
              key={label}
              aria-current={isCurrent ? 'step' : undefined}
              className="flex min-w-0 flex-1 flex-col gap-1"
            >
              <span
                className={cn(
                  'h-1.5 w-full rounded-full',
                  isCurrent ? 'bg-primary' : done ? 'bg-success' : 'bg-border',
                )}
              />
              <span
                className={cn(
                  'truncate text-xs',
                  isCurrent
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {index + 1}. {label}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
