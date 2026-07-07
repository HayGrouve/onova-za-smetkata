import { createContext, useContext, useState } from 'react'
import { PaymentSettingsSheet } from '#/components/bills/payment-settings-sheet.tsx'

interface PaymentSettingsContextValue {
  openPaymentSettings: () => void
}

const PaymentSettingsContext =
  createContext<PaymentSettingsContextValue | null>(null)

export function PaymentSettingsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <PaymentSettingsContext.Provider
      value={{ openPaymentSettings: () => setOpen(true) }}
    >
      {children}
      <PaymentSettingsSheet open={open} onOpenChange={setOpen} />
    </PaymentSettingsContext.Provider>
  )
}

export function usePaymentSettingsSheet(): PaymentSettingsContextValue {
  const context = useContext(PaymentSettingsContext)
  if (!context) {
    throw new Error(
      'usePaymentSettingsSheet must be used within PaymentSettingsProvider',
    )
  }
  return context
}
