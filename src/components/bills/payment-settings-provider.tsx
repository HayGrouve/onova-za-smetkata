import { useHostAuth } from '#/hooks/use-host-auth.ts'
import { useQuery } from 'convex/react'
import { createContext, useContext, useState } from 'react'
import {
  MountOnFirstOpen,
  lazySheet,
  usePreloadWhenIdle,
} from '#/components/lazy-sheet.tsx'
import { getPaymentSettingsStatus } from '#/lib/payment-settings.ts'
import type {
  PaymentSettings,
  PaymentSettingsStatus,
} from '#/lib/payment-settings.ts'
import { api } from '../../../convex/_generated/api'

const paymentSettingsSheet = lazySheet(() =>
  import('#/components/bills/payment-settings-sheet.tsx').then(
    (m) => m.PaymentSettingsSheet,
  ),
)
const PaymentSettingsSheet = paymentSettingsSheet.Sheet

const SHEET_LOADERS = [paymentSettingsSheet.preload]

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
  const { isSignedIn } = useHostAuth()
  usePreloadWhenIdle(Boolean(isSignedIn), SHEET_LOADERS)
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
      <MountOnFirstOpen open={open} onClose={() => setOpen(false)}>
        <PaymentSettingsSheet open={open} onOpenChange={setOpen} />
      </MountOnFirstOpen>
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
