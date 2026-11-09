import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ReceiptLoading } from '#/components/receipt/receipt-states.tsx'
import { Receipt } from '#/components/receipt/paper.tsx'
import { HostProSubscriptionPanel } from '#/components/subscription/host-pro-subscription-panel.tsx'
import { useHostProStatus } from '#/hooks/use-host-pro.ts'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'

/**
 * Абонамент (`/abonament`): Host Pro plan, Checkout and the Customer Portal.
 * Stripe returns here (`?checkout=success&session_id=…`, read by the panel).
 * While the billing switch is off there is no Абонамент page, so a signed in
 * Host goes Home.
 */
export function SubscriptionPage() {
  const { isAuthenticated, isLoading } = useRequireHostAuth('/abonament')
  const hostPro = useHostProStatus()
  const navigate = useNavigate()
  const billingOff = hostPro !== undefined && !hostPro?.enabled

  useEffect(() => {
    if (isAuthenticated && billingOff) {
      void navigate({ to: '/', replace: true })
    }
  }, [isAuthenticated, billingOff, navigate])

  if (isLoading || !isAuthenticated || !hostPro?.enabled) {
    return <ReceiptLoading lines={3} />
  }

  return (
    <div className="mx-auto w-full max-w-lg px-3 pt-4 pb-24 sm:pt-10">
      <Receipt>
        <HostProSubscriptionPanel />
      </Receipt>
    </div>
  )
}
