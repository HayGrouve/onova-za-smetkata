import { useAction, useConvexAuth, useQuery } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../convex/_generated/api'
import type { HostProInterval } from '../../shared/host-pro-plans.ts'

/** Host Pro state for the signed-in Host; `undefined` while loading. */
export function useHostProStatus() {
  const { isAuthenticated } = useConvexAuth()
  const [nowMs] = useState(() => Date.now())
  return useQuery(api.billing.status, isAuthenticated ? { nowMs } : 'skip')
}

function errorMessage(error: unknown, fallback: string): string {
  const data =
    error && typeof error === 'object' && 'data' in error
      ? Reflect.get(error, 'data')
      : undefined
  if (typeof data === 'string' && data.trim()) return data
  const message =
    data && typeof data === 'object' ? Reflect.get(data, 'message') : undefined
  return typeof message === 'string' && message.trim() ? message : fallback
}

/** Leaves the app for Stripe Checkout (Managed Payments). */
export function useHostProCheckout() {
  const createCheckoutSession = useAction(
    api.billingStripe.createCheckoutSession,
  )
  const [isRedirecting, setIsRedirecting] = useState(false)

  async function startCheckout(interval: HostProInterval) {
    setIsRedirecting(true)
    try {
      const { url } = await createCheckoutSession({
        interval,
        withdrawalWaiver: true,
      })
      window.location.assign(url)
    } catch (error) {
      setIsRedirecting(false)
      toast.error(errorMessage(error, 'Неуспешно отваряне на плащането.'))
    }
  }

  return { startCheckout, isRedirecting }
}

/** Leaves the app for the Stripe Customer Portal. */
export function useHostProPortal() {
  const createPortalSession = useAction(api.billingStripe.createPortalSession)
  const [isRedirecting, setIsRedirecting] = useState(false)

  async function openPortal() {
    setIsRedirecting(true)
    try {
      const { url } = await createPortalSession({})
      window.location.assign(url)
    } catch (error) {
      setIsRedirecting(false)
      toast.error(errorMessage(error, 'Неуспешно отваряне на абонамента.'))
    }
  }

  return { openPortal, isRedirecting }
}
