import { useHostAuth } from '#/hooks/use-host-auth.ts'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export function useRequireHostAuth(redirectPath: string) {
  const { isSignedIn, isLoaded } = useHostAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) {
      void navigate({
        to: '/login',
        search: { redirect: redirectPath },
      })
    }
  }, [isLoaded, isSignedIn, navigate, redirectPath])

  return {
    isAuthenticated: isSignedIn ?? false,
    isLoading: !isLoaded,
  }
}
