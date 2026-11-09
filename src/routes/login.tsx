import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth, useClerk } from '@clerk/tanstack-react-start'
import { useEffect, useRef } from 'react'
import { ReceiptLoading } from '#/components/receipt/receipt-states.tsx'
import { safeRedirectPath } from '#/lib/safe-redirect-path.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

/**
 * `/login` renders no sign-in form: Host sign-in lives on the hub (ADR 0005).
 * Signed out, it bounces to Clerk's sign-in URL with the full return URL:
 * `https://onovaza.com/vhod` in production, the dev Account Portal where the
 * sign-in URL env is unset (local, previews). Old links and
 * `useRequireHostAuth` still land here.
 */
export const Route = createFileRoute('/login')({
  head: () => buildNoIndexHead('Вход'),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: safeRedirectPath(search.redirect),
  }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect = '/' } = Route.useSearch()
  const { isSignedIn, isLoaded } = useAuth()
  const clerk = useClerk()
  const navigate = useNavigate()
  const bounced = useRef(false)

  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn) {
      // `redirect` may carry a search string (`/bills/…?step=3`): an href,
      // not a route path.
      void navigate({ href: redirect, replace: true })
      return
    }
    if (bounced.current) return
    bounced.current = true
    void clerk.redirectToSignIn({
      redirectUrl: new URL(redirect, window.location.origin).href,
    })
  }, [clerk, isLoaded, isSignedIn, navigate, redirect])

  return <ReceiptLoading lines={3} />
}
