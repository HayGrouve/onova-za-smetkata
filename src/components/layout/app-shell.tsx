import { AppHeader } from '#/components/layout/app-header.tsx'
import { AppFooter } from '#/components/layout/app-footer.tsx'
import { OfflineBanner } from '#/components/layout/offline-banner.tsx'
import { BillHeaderTitleProvider } from '#/components/layout/bill-header-title.tsx'
import { PaymentSettingsProvider } from '#/components/bills/payment-settings-provider.tsx'
import { PwaInstallProvider } from '#/components/pwa-install-provider.tsx'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PwaInstallProvider>
      <PaymentSettingsProvider>
        <BillHeaderTitleProvider>
          <div className="flex min-h-dvh flex-col">
            <AppHeader />
            <OfflineBanner />
            <main className="flex-1">{children}</main>
            <AppFooter />
          </div>
        </BillHeaderTitleProvider>
      </PaymentSettingsProvider>
    </PwaInstallProvider>
  )
}
