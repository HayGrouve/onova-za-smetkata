import { useConvexAuth } from '@convex-dev/auth/react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { isClientDevMode } from '#/lib/dev-mode.ts'

export function useRequireHostAuth(redirectPath: string) {
  const devMode = isClientDevMode()
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()
  const navigate = useNavigate()

  const waitingForDevAuth = devMode && !isAuthenticated

  useEffect(() => {
    if (devMode) return
    if (!authLoading && !isAuthenticated) {
      void navigate({
        to: '/login',
        search: { redirect: redirectPath },
      })
    }
  }, [authLoading, devMode, isAuthenticated, navigate, redirectPath])

  return {
    isAuthenticated,
    isLoading: authLoading || waitingForDevAuth,
  }
}
