import { ArrowRightIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { formatEur } from '#/lib/format-currency.ts'

export interface ClaimPayBarProps {
  label: string
  amountCents: number
  actionLabel: string
  onAction: () => void
  actionDisabled?: boolean
  note?: ReactNode
}

/** Sticky bottom bar on the claim page: running share + next step. */
export function ClaimPayBar({
  label,
  amountCents,
  actionLabel,
  onAction,
  actionDisabled = false,
  note,
}: ClaimPayBarProps) {
  return (
    <>
      {/* In-flow spacer — the fixed bar does not reserve layout space. */}
      <div
        aria-hidden
        className="h-[calc(5rem+env(safe-area-inset-bottom,0px))]"
      />
      <div className="sticky-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg flex-col gap-1 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{label}</p>
              <p
                key={amountCents}
                className="guest-total-pulse money text-lg font-semibold"
                data-testid="claim-pay-bar-amount"
              >
                {formatEur(amountCents)}
              </p>
            </div>
            <Button
              type="button"
              className="h-11 shrink-0"
              disabled={actionDisabled}
              onClick={onAction}
            >
              {actionLabel}
              <ArrowRightIcon className={ICON.button} aria-hidden />
            </Button>
          </div>
          {note ? (
            <p className="text-xs text-muted-foreground">{note}</p>
          ) : null}
        </div>
      </div>
    </>
  )
}
