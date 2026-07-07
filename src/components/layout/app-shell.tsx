import { AppHeader } from '#/components/layout/app-header.tsx'
import { PaymentSettingsProvider } from '#/components/bills/payment-settings-provider.tsx'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PaymentSettingsProvider>
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main className="flex-1">{children}</main>
      </div>
    </PaymentSettingsProvider>
  )
}
