import { UserProfile } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2Icon, SparklesIcon } from 'lucide-react'
import { HostProSubscriptionPanel } from '#/components/subscription/host-pro-subscription-panel.tsx'
import { useHostProStatus } from '#/hooks/use-host-pro.ts'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { ICON } from '#/lib/app-icons.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

export const Route = createFileRoute('/user-profile/$')({
  head: () => buildNoIndexHead('Акаунт'),
  component: HostAccountPage,
})

function HostAccountFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-10 text-muted-foreground">
      <Loader2Icon className={`${ICON.button} mr-2 animate-spin`} aria-hidden />
      Зареждане...
    </div>
  )
}

function HostAccountPage() {
  const { isAuthenticated, isLoading: authLoading } =
    useRequireHostAuth('/user-profile')
  const hostPro = useHostProStatus()

  // Wait for the billing switch: Clerk only routes to custom pages it was
  // rendered with, and Checkout returns to /user-profile/subscription.
  if (authLoading || !isAuthenticated || hostPro === undefined) {
    return <HostAccountFallback />
  }

  return (
    <div className="host-account-clerk">
      <UserProfile
        routing="path"
        path="/user-profile"
        apiKeysProps={{ hide: true }}
        fallback={<HostAccountFallback />}
        appearance={{ elements: { rootBox: 'mx-auto w-fit max-w-full' } }}
      >
        {hostPro?.enabled ? (
          <UserProfile.Page
            label="Абонамент"
            url="subscription"
            labelIcon={<SparklesIcon className="size-4" aria-hidden />}
          >
            <HostProSubscriptionPanel />
          </UserProfile.Page>
        ) : null}
      </UserProfile>
    </div>
  )
}
