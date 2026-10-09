import { useHostAuth } from '#/hooks/use-host-auth.ts'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'

export function useRequireHostAuth(redirectPath: string) {
  const { isSignedIn, isLoaded } = useHostAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const searchStr = useRouterState({ select: (s) => s.location.searchStr })
  // Back to exactly where the Host was (`?step=3` and all) when the page is
  // the one asked for; `redirectPath` alone otherwise.
  const onRedirectPage =
    pathname === redirectPath || pathname.startsWith(`${redirectPath}/`)
  const redirect = onRedirectPage ? `${pathname}${searchStr}` : redirectPath

  useEffect(() => {
    if (!isLoaded) return
    // Already on the way: the page stays mounted for a moment on /login, and
    // a second redirect from there would drop the search string.
    if (pathname === '/login') return
    if (!isSignedIn) {
      void navigate({
        to: '/login',
        search: { redirect },
      })
    }
  }, [isLoaded, isSignedIn, navigate, pathname, redirect])

  return {
    isAuthenticated: isSignedIn ?? false,
    isLoading: !isLoaded,
  }
}
