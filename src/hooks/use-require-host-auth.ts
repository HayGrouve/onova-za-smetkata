import { useAuth } from '@clerk/tanstack-react-start'
import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

export function useRequireHostAuth(redirectPath: string) {
  const { isSignedIn, isLoaded } = useAuth()
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
