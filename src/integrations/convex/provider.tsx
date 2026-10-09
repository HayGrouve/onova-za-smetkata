import { ClerkProvider, useAuth } from '@clerk/tanstack-react-start'
import { useRouterState } from '@tanstack/react-router'
import {
  ConvexProviderWithAuth,
  ConvexReactClient,
  useMutation,
} from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { Suspense, use, useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { assertConvexUrlForBuild } from '#/lib/env.ts'
import { getClerkPublishableKey } from '#/lib/clerk-env.ts'
import type { clerkBgLocalization } from '#/lib/clerk-bg-localization.ts'
import { SubscriptionProvider } from '#/components/subscription/subscription-provider.tsx'
import { HostAuthContext } from '#/hooks/use-host-auth.ts'
import type { HostAuthState } from '#/hooks/use-host-auth.ts'
import { isGuestPage } from '../../../shared/app-header-route-context.ts'

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

const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null

type ClerkLocalization = typeof clerkBgLocalization

/**
 * The Bulgarian strings are ~78 KB, so they load beside the entry bundle
 * instead of inside it, and only where Clerk runs. ClerkProvider waits for
 * them (see ClerkTree), so Clerk never draws a screen in English; if they fail
 * to load, Clerk mounts without them rather than not at all.
 */
let clerkLocalizationPromise: Promise<ClerkLocalization | null> | undefined
/** `undefined` while loading, `null` if the load failed. */
let loadedClerkLocalization: ClerkLocalization | null | undefined
function loadClerkLocalization(): Promise<ClerkLocalization | null> {
  clerkLocalizationPromise ??= import('#/lib/clerk-bg-localization.ts').then(
    (module) => (loadedClerkLocalization = module.clerkBgLocalization),
    (error: unknown) => {
      console.error('Clerk Bulgarian localization failed to load', error)
      return (loadedClerkLocalization = null)
    },
  )
  return clerkLocalizationPromise
}

// Start fetching while the entry bundle is still evaluating, before React
// hydrates, on every page that will mount Clerk.
if (
  typeof window !== 'undefined' &&
  !isGuestPage(window.location.pathname, window.location.search)
) {
  void loadClerkLocalization()
}

/**
 * Suspends until the strings have loaded (or failed). The server renders
 * without them: Clerk draws nothing there, so the markup is the same, and the
 * browser keeps the server HTML on screen while hydration waits.
 */
function useClerkLocalization(): ClerkLocalization | undefined {
  if (import.meta.env.SSR) return undefined
  const loaded =
    loadedClerkLocalization !== undefined
      ? loadedClerkLocalization
      : use(loadClerkLocalization())
  return loaded ?? undefined
}

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

function ClerkTree(props: ClerkTreeProps) {
  return (
    <Suspense fallback={<ShellMessage>Зареждане...</ShellMessage>}>
      <LocalizedClerkTree {...props} />
    </Suspense>
  )
}

function LocalizedClerkTree({
  client,
  publishableKey,
  children,
}: ClerkTreeProps) {
  const localization = useClerkLocalization()
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={localization}
      appearance={CLERK_APPEARANCE}
    >
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

function ShellMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
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
