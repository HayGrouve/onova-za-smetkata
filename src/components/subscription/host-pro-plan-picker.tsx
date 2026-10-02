import { Link } from '@tanstack/react-router'
import { Loader2Icon } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
import { Label } from '#/components/ui/label.tsx'
import { useHostProCheckout } from '#/hooks/use-host-pro.ts'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'
import {
  HOST_PRO_DISCLOSURES,
  HOST_PRO_INTERVALS,
  HOST_PRO_PLANS,
} from '../../../shared/host-pro-plans.ts'
import type { HostProInterval } from '../../../shared/host-pro-plans.ts'

/** Monthly/annual choice, the pre-checkout disclosures, and the Checkout button. */
export function HostProPlanPicker({ className }: { className?: string }) {
  const consentId = useId()
  const [selected, setSelected] = useState<HostProInterval>('year')
  const [waivesWithdrawal, setWaivesWithdrawal] = useState(false)
  const { startCheckout, isRedirecting } = useHostProCheckout()

  return (
    <div className={cn('space-y-4', className)}>
      <div
        role="radiogroup"
        aria-label="Период на плащане"
        className="grid grid-cols-2 gap-2"
      >
        {HOST_PRO_INTERVALS.map((interval) => {
          const plan = HOST_PRO_PLANS[interval]
          const isSelected = interval === selected
          return (
            <button
              key={interval}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(interval)}
              className={cn(
                'rounded-md border-2 px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isSelected ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <span className="block text-xs text-muted-foreground">
                {plan.label}
              </span>
              <span className="block font-semibold">
                {plan.price}
                <span className="text-xs font-normal text-muted-foreground">
                  {' '}
                  / {plan.period}
                </span>
              </span>
              {plan.note ? (
                <span className="block text-xs text-primary">{plan.note}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
        <li>{HOST_PRO_DISCLOSURES.pricing}</li>
        <li>{HOST_PRO_DISCLOSURES.cancel}</li>
        <li>
          {HOST_PRO_DISCLOSURES.seller} Вижте{' '}
          <Link to="/terms" className="underline underline-offset-2">
            Общите условия
          </Link>
          .
        </li>
      </ul>

      <div className="flex items-start gap-2">
        <Checkbox
          id={consentId}
          checked={waivesWithdrawal}
          onCheckedChange={(checked) => setWaivesWithdrawal(checked === true)}
          className="mt-0.5"
        />
        <Label htmlFor={consentId} className="text-xs leading-snug font-normal">
          {HOST_PRO_DISCLOSURES.withdrawalConsent}
        </Label>
      </div>

      <Button
        type="button"
        className="h-11 w-full"
        disabled={!waivesWithdrawal || isRedirecting}
        onClick={() => void startCheckout(selected)}
      >
        {isRedirecting ? (
          <Loader2Icon className={`${ICON.button} animate-spin`} aria-hidden />
        ) : null}
        Продължи към плащане
      </Button>
    </div>
  )
}
