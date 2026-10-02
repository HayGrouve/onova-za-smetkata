import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { useMutation } from 'convex/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { assertConvexUrlForBuild } from '#/lib/env.ts'
import { getClerkPublishableKey } from '#/lib/clerk-env.ts'
import { clerkBgLocalization } from '#/lib/clerk-bg-localization.ts'
import { SubscriptionProvider } from '#/components/subscription/subscription-provider.tsx'

const convexUrl = assertConvexUrlForBuild()

/**
 * Clerk's sign-in and account screens are printed paper too: ink on thermal
 * white with a vermilion action. Paper stays light in dark mode, so these are
 * fixed values (the paper tokens from styles.css). Every text colour is set:
 * whatever is left to Clerk follows the page's dark color-scheme and turns
 * white on the paper card.
 */
const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: '#c83314',
    colorBackground: '#fbfaf8',
    colorForeground: '#161b22',
    colorMutedForeground: '#5e646c',
    colorInput: '#fbfaf8',
    colorInputForeground: '#161b22',
    colorNeutral: '#161b22',
    colorDanger: '#b7162d',
    borderRadius: '2px',
    fontFamily: "'Martian Mono Variable', ui-monospace, monospace",
    fontFamilyButtons: "'Unbounded Variable', ui-sans-serif, sans-serif",
  },
  elements: {
    card: { boxShadow: '0 22px 40px -18px rgba(20, 26, 36, 0.45)' },
    formButtonPrimary: { borderRadius: '999px', fontWeight: 700 },
    socialButtonsBlockButton: { borderRadius: '999px' },
  },
}
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
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      localization={clerkBgLocalization}
      appearance={CLERK_APPEARANCE}
    >
      <ConvexProviderWithClerk client={client} useAuth={useAuth}>
        <EnsureConvexUser>
          <SubscriptionProvider>{children}</SubscriptionProvider>
        </EnsureConvexUser>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}
