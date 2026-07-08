import Google from '@auth/core/providers/google'
import Resend from '@auth/core/providers/resend'
import { Password } from '@convex-dev/auth/providers/Password'
import { convexAuth } from '@convex-dev/auth/server'
import type { AuthProviderConfig } from '@convex-dev/auth/server'
import { DEV_USER_EMAIL, DEV_USER_NAME, isDevModeEnabled } from './lib/devMode'

const providers: AuthProviderConfig[] = [
  Google,
  Resend({
    from:
      process.env.AUTH_RESEND_FROM ??
      'Онова за сметката <onboarding@resend.dev>',
  }),
]

if (isDevModeEnabled()) {
  providers.push(
    Password({
      profile: () => ({
        email: DEV_USER_EMAIL,
        name: DEV_USER_NAME,
        emailVerified: true,
      }),
      validatePasswordRequirements: () => {},
    }),
  )
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers,
})
