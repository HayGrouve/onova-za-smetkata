import { AppHeader } from '#/components/layout/app-header.tsx'
import { AppFooter } from '#/components/layout/app-footer.tsx'
import { OfflineBanner } from '#/components/layout/offline-banner.tsx'
import { BillHeaderTitleProvider } from '#/components/layout/bill-header-title.tsx'
import { PaymentSettingsProvider } from '#/components/bills/payment-settings-provider.tsx'
import { HostOnboardingProvider } from '#/components/host-onboarding/host-onboarding-provider.tsx'
import { FriendGroupsProvider } from '#/components/bills/friend-groups-provider.tsx'
import { PwaInstallProvider } from '#/components/pwa-install-provider.tsx'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <PwaInstallProvider>
      <PaymentSettingsProvider>
        <HostOnboardingProvider>
          <FriendGroupsProvider>
            <BillHeaderTitleProvider>
              <div className="flex min-h-dvh flex-col">
                <a
                  href="#main"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-paper focus:px-3 focus:py-2 focus:text-[13px] focus:font-semibold focus:shadow-lg"
                >
                  Към съдържанието
                </a>
                <AppHeader />
                <OfflineBanner />
                <main
                  id="main"
                  tabIndex={-1}
                  className="flex flex-1 flex-col outline-none"
                >
                  {children}
                </main>
                <AppFooter />
              </div>
            </BillHeaderTitleProvider>
          </FriendGroupsProvider>
        </HostOnboardingProvider>
      </PaymentSettingsProvider>
    </PwaInstallProvider>
  )
}
