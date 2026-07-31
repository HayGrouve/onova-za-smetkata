import { useAuth } from '@clerk/tanstack-react-start'
import { useQuery } from 'convex/react'
import { createContext, useContext, useState } from 'react'
import { PaymentSettingsSheet } from '#/components/bills/payment-settings-sheet.tsx'
import { getPaymentSettingsStatus } from '#/lib/payment-settings.ts'
import type {
  PaymentSettings,
  PaymentSettingsStatus,
} from '#/lib/payment-settings.ts'
import { api } from '../../../convex/_generated/api'

interface PaymentSettingsContextValue {
  openPaymentSettings: () => void
  settings: PaymentSettings | null | undefined
  status: PaymentSettingsStatus
}

const PaymentSettingsContext =
  createContext<PaymentSettingsContextValue | null>(null)

export function PaymentSettingsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const { isSignedIn } = useAuth()
  const settings = useQuery(api.paymentSettings.get, isSignedIn ? {} : 'skip')
  const status: PaymentSettingsStatus = isSignedIn
    ? getPaymentSettingsStatus(settings)
    : 'unconfigured'

  return (
    <PaymentSettingsContext.Provider
      value={{
        openPaymentSettings: () => setOpen(true),
        settings: isSignedIn ? settings : null,
        status,
      }}
    >
      {children}
      <PaymentSettingsSheet open={open} onOpenChange={setOpen} />
    </PaymentSettingsContext.Provider>
  )
}

export function usePaymentSettings(): PaymentSettingsContextValue {
  const context = useContext(PaymentSettingsContext)
  if (!context) {
    throw new Error(
      'usePaymentSettings must be used within PaymentSettingsProvider',
    )
  }
  return context
}

export function usePaymentSettingsSheet(): Pick<
  PaymentSettingsContextValue,
  'openPaymentSettings'
> {
  return usePaymentSettings()
}
