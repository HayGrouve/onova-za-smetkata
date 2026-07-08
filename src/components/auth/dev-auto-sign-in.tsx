import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { useEffect, useRef } from 'react'
import { DEV_USER_EMAIL, DEV_USER_PASSWORD } from '#/lib/dev-user.ts'
import { isClientDevMode } from '#/lib/dev-mode.ts'

async function ensureDevSignIn(
  signIn: ReturnType<typeof useAuthActions>['signIn'],
) {
  try {
    await signIn('password', {
      flow: 'signIn',
      email: DEV_USER_EMAIL,
      password: DEV_USER_PASSWORD,
    })
  } catch {
    await signIn('password', {
      flow: 'signUp',
      email: DEV_USER_EMAIL,
      password: DEV_USER_PASSWORD,
    })
  }
}

export function DevAutoSignIn({ children }: { children: React.ReactNode }) {
  const devMode = isClientDevMode()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { signIn } = useAuthActions()
  const signingInRef = useRef(false)

  useEffect(() => {
    if (!devMode) return
    if (isLoading || isAuthenticated || signingInRef.current) return

    signingInRef.current = true
    void ensureDevSignIn(signIn).finally(() => {
      signingInRef.current = false
    })
  }, [devMode, isAuthenticated, isLoading, signIn])

  return children
}
