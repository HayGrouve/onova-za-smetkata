import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { useRouterState } from '@tanstack/react-router'
import {
  ConvexProviderWithAuth,
  ConvexReactClient,
  useMutation,
} from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { assertConvexUrlForBuild } from '#/lib/env.ts'
import { getClerkPublishableKey } from '#/lib/clerk-env.ts'
import { SubscriptionProvider } from '#/components/subscription/subscription-provider.tsx'
import { HostAuthContext } from '#/hooks/use-host-auth.ts'
import type { HostAuthState } from '#/hooks/use-host-auth.ts'
import { isGuestPage } from '../../../shared/app-header-route-context.ts'

const convexUrl = assertConvexUrlForBuild()

const clerkPublishableKey = getClerkPublishableKey()

const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null

/**
 * Clerk (its provider plus ~1 MB of scripts from Clerk's CDN) runs on every
 * page except the Guest share-link pages, which never need an account. Once a
 * phone has been on a Host page Clerk stays mounted, so moving between the two
 * remounts the app at most once.
 */
function useClerkNeeded(): boolean {
  const onGuestPage = useRouterState({
    select: (state) =>
      isGuestPage(state.location.pathname, state.location.searchStr),
  })
  const [clerkMounted, setClerkMounted] = useState(!onGuestPage)
  if (!onGuestPage && !clerkMounted) setClerkMounted(true)
  return clerkMounted || !onGuestPage
}

const GUEST_HOST_AUTH: HostAuthState = { isLoaded: true, isSignedIn: false }
const GUEST_CONVEX_AUTH = {
  isLoading: false,
  isAuthenticated: false,
  fetchAccessToken: () => Promise.resolve(null),
}
function useGuestConvexAuth() {
  return GUEST_CONVEX_AUTH
}

function ClerkHostAuth({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth()
  const value = useMemo(
    () => ({ isLoaded, isSignedIn }),
    [isLoaded, isSignedIn],
  )
  return (
    <HostAuthContext.Provider value={value}>
      {children}
    </HostAuthContext.Provider>
  )
}

type ClerkTreeProps = {
  client: ConvexReactClient
  publishableKey: string
  children: React.ReactNode
}

function ClerkTree({ client, publishableKey, children }: ClerkTreeProps) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkHostAuth>
        <ConvexProviderWithClerk client={client} useAuth={useAuth}>
          <EnsureConvexUser>
            <SubscriptionProvider>{children}</SubscriptionProvider>
          </EnsureConvexUser>
        </ConvexProviderWithClerk>
      </ClerkHostAuth>
    </ClerkProvider>
  )
}

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
          Неуспешно свързване с профила. Опитай да презаредиш страницата.
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
  const clerkNeeded = useClerkNeeded()

  if (!convexClient) {
    return <MissingConvexConfig />
  }

  if (!clerkPublishableKey) {
    return <MissingClerkConfig />
  }

  if (!clerkNeeded) {
    return (
      <HostAuthContext.Provider value={GUEST_HOST_AUTH}>
        <ConvexProviderWithAuth
          client={convexClient}
          useAuth={useGuestConvexAuth}
        >
          <SubscriptionProvider>{children}</SubscriptionProvider>
        </ConvexProviderWithAuth>
      </HostAuthContext.Provider>
    )
  }

  return (
    <ClerkTree client={convexClient} publishableKey={clerkPublishableKey}>
      {children}
    </ClerkTree>
  )
}
