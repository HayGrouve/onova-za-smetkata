import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { QuotaErrorCode } from '../../../shared/subscription-messages.ts'
import { SUBSCRIPTION_MESSAGES } from '../../../shared/subscription-messages.ts'
import { parseQuotaError } from '#/lib/convex-quota-error.ts'
import { QuotaPaywallSheet } from '#/components/subscription/quota-paywall-sheet.tsx'

type SubscriptionContextValue = {
  openPaywall: (code?: QuotaErrorCode, message?: string) => void
  handleMutationError: (error: unknown) => boolean
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

export function SubscriptionProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string>(
    SUBSCRIPTION_MESSAGES.QUOTA_BILLS,
  )
  const openPaywall = useCallback(
    (code?: QuotaErrorCode, customMessage?: string) => {
      setMessage(
        customMessage ??
          (code
            ? SUBSCRIPTION_MESSAGES[code]
            : SUBSCRIPTION_MESSAGES.QUOTA_BILLS),
      )
      setOpen(true)
    },
    [],
  )

  const handleMutationError = useCallback(
    (error: unknown) => {
      const parsed = parseQuotaError(error)
      if (!parsed) return false
      openPaywall(parsed.code, parsed.message)
      return true
    },
    [openPaywall],
  )

  const value = useMemo(
    () => ({ openPaywall, handleMutationError }),
    [handleMutationError, openPaywall],
  )

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <QuotaPaywallSheet open={open} onOpenChange={setOpen} message={message} />
    </SubscriptionContext.Provider>
  )
}

export function useSubscriptionPaywall() {
  const context = useContext(SubscriptionContext)
  if (!context) {
    throw new Error(
      'useSubscriptionPaywall must be used within SubscriptionProvider',
    )
  }
  return context
}
