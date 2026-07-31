import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { bgBG } from '@clerk/localizations'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { assertConvexUrlForBuild } from '#/lib/env.ts'
import { getClerkPublishableKey } from '#/lib/clerk-env.ts'
import { SubscriptionProvider } from '#/components/subscription/subscription-provider.tsx'

const convexUrl = assertConvexUrlForBuild()
const clerkPublishableKey = getClerkPublishableKey()

const convexQueryClient = convexUrl ? new ConvexQueryClient(convexUrl) : null

function MissingConvexConfig() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4 text-center">
      <p className="text-sm text-muted-foreground">
        Липсва конфигурация на сървъра (VITE_CONVEX_URL).
      </p>
    </div>
  )
}

function MissingClerkConfig() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4 text-center">
      <p className="text-sm text-muted-foreground">
        Липсва конфигурация на входа (VITE_CLERK_PUBLISHABLE_KEY).
      </p>
    </div>
  )
}

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  if (!convexQueryClient) {
    return <MissingConvexConfig />
  }

  if (!clerkPublishableKey) {
    return <MissingClerkConfig />
  }

  const client = convexQueryClient.convexClient

  return (
    <ClerkProvider publishableKey={clerkPublishableKey} localization={bgBG}>
      <ConvexProviderWithClerk client={client} useAuth={useAuth}>
        <SubscriptionProvider>{children}</SubscriptionProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
