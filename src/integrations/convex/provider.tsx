import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { bgBG } from '@clerk/localizations'
import { useMutation } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
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

function EnsureConvexUser({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const ensureCurrent = useMutation(api.users.ensureCurrent)
  const [convexUserReady, setConvexUserReady] = useState(false)
  const [syncFailed, setSyncFailed] = useState(false)

  useEffect(() => {
    if (!isLoaded) {
      setConvexUserReady(false)
      setSyncFailed(false)
      return
    }

    if (!isSignedIn) {
      setConvexUserReady(true)
      setSyncFailed(false)
      return
    }

    let cancelled = false
    setConvexUserReady(false)
    setSyncFailed(false)

    void ensureCurrent()
      .then(() => {
        if (!cancelled) setConvexUserReady(true)
      })
      .catch(() => {
        if (!cancelled) setSyncFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [ensureCurrent, isLoaded, isSignedIn])

  if (!isLoaded || (isSignedIn && !convexUserReady && !syncFailed)) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">Зареждане...</p>
      </div>
    )
  }

  if (syncFailed) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4 text-center">
        <p className="text-sm text-muted-foreground">
          Неуспешно свързване с профила. Опитайте да презаредите страницата.
        </p>
      </div>
    )
  }

  return children
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
        <EnsureConvexUser>
          <SubscriptionProvider>{children}</SubscriptionProvider>
        </EnsureConvexUser>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
