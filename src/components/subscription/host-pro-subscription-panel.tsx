import { useAction } from 'convex/react'
import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { HostProPlanPicker } from '#/components/subscription/host-pro-plan-picker.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useHostProPortal, useHostProStatus } from '#/hooks/use-host-pro.ts'
import { ICON } from '#/lib/app-icons.ts'
import { api } from '../../../convex/_generated/api'
import { HOST_FREE_PLAN_SUMMARY } from '../../../shared/host-pro-plans.ts'

const dateFormatter = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

type HostProStatus = NonNullable<ReturnType<typeof useHostProStatus>>

function planSummary(status: HostProStatus): string {
  const periodEnd =
    status.currentPeriodEnd !== undefined
      ? dateFormatter.format(status.currentPeriodEnd)
      : null
  if (status.subscriptionStatus === 'past_due') {
    return 'Последното плащане не мина. Обновете картата си, за да запазите Pro.'
  }
  if (status.cancelAtPeriodEnd && periodEnd) {
    return `Абонаментът е отказан и Pro остава активен до ${periodEnd}.`
  }
  return periodEnd ? `Подновява се на ${periodEnd}.` : 'Pro е активен.'
}

/**
 * Reads `?checkout=success&session_id=…` once after Stripe sends the Host
 * back, syncs the subscription right away, and clears the query string.
 */
function useCheckoutReturn() {
  const syncAfterCheckout = useAction(api.billingStripe.syncAfterCheckout)
  const [isConfirming, setIsConfirming] = useState(false)
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    const url = new URL(window.location.href)
    const checkout = url.searchParams.get('checkout')
    const sessionId = url.searchParams.get('session_id')
    if (!checkout) return

    url.searchParams.delete('checkout')
    url.searchParams.delete('session_id')
    window.history.replaceState(window.history.state, '', url)

    if (checkout === 'cancelled') {
      toast('Плащането е прекъснато. Не е таксувано нищо.')
      return
    }
    if (checkout !== 'success' || !sessionId) return

    setIsConfirming(true)
    syncAfterCheckout({ sessionId })
      .then(() => toast.success('Pro е активен. Благодарим!'))
      .catch(() => toast('Плащането е прието. Pro ще се активира до минута.'))
      .finally(() => setIsConfirming(false))
  }, [syncAfterCheckout])

  return isConfirming
}

/** The „Абонамент“ page in the Host account (shown only while billing is on). */
export function HostProSubscriptionPanel() {
  const status = useHostProStatus()
  const isConfirming = useCheckoutReturn()
  const { openPortal, isRedirecting } = useHostProPortal()

  if (status === undefined || isConfirming) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2Icon className={`${ICON.button} animate-spin`} aria-hidden />
        {isConfirming ? 'Потвърждаваме плащането…' : 'Зареждане...'}
      </div>
    )
  }
  if (status === null) return null

  const isPro = status.tier === 'pro'

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <SparklesIcon className={ICON.section} aria-hidden />
          {isPro ? 'Онова за сметката Pro' : 'Безплатен план'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isPro ? planSummary(status) : HOST_FREE_PLAN_SUMMARY}
        </p>
      </div>

      {isPro ? null : <HostProPlanPicker />}

      {status.hasBillingAccount ? (
        <Button
          type="button"
          variant={isPro ? 'outline' : 'link'}
          className={isPro ? 'h-11 w-full' : 'w-full'}
          disabled={isRedirecting}
          onClick={() => void openPortal()}
        >
          {isRedirecting ? (
            <Loader2Icon
              className={`${ICON.button} animate-spin`}
              aria-hidden
            />
          ) : null}
          {isPro ? 'Управление на абонамента' : 'Плащания и фактури'}
        </Button>
      ) : null}
    </div>
  )
}
