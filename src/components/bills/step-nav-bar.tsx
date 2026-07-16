import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { formatEur } from '#/lib/format-currency.ts'

export interface StepNavBarProps {
  step: BillStep
  onStepChange: (step: BillStep) => void
  totalCents: number
  unassignedCount: number
  onTotalClick: () => void
}

export function StepNavBar({
  step,
  onStepChange,
  totalCents,
  unassignedCount,
  onTotalClick,
}: StepNavBarProps) {
  return (
    <>
      {/* In-flow spacer — the fixed bar does not reserve layout space. */}
      <div
        aria-hidden
        className="h-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
      />
      <div className="sticky-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onTotalClick}
            aria-label="Разбивка на сметката"
            className="tap-feedback cursor-pointer text-left"
          >
            <p className="text-xs text-muted-foreground">Общо</p>
            <p className="money font-semibold">{formatEur(totalCents)}</p>
          </button>
          {step === 3 && unassignedCount > 0 && (
            <Badge className="bg-accent text-accent-foreground">
              {unassignedCount} неразпределени
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                className="h-11"
                onClick={() => onStepChange((step - 1) as BillStep)}
              >
                Назад
              </Button>
            )}
            <Button
              className="h-11"
              onClick={() => onStepChange((step + 1) as BillStep)}
            >
              Напред
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
