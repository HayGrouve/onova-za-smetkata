import { useConvexAuth } from '@convex-dev/auth/react'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export function useRequireHostAuth(redirectPath: string) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({
        to: '/login',
        search: { redirect: redirectPath },
      })
    }
  }, [isAuthenticated, isLoading, navigate, redirectPath])

  return { isAuthenticated, isLoading }
}
