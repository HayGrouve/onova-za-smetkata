import { createStart } from '@tanstack/react-start'
import { clerkMiddleware } from '@clerk/tanstack-react-start/server'
import { parseAuthorizedParties } from '#/lib/clerk-authorized-parties.ts'

export const startInstance = createStart(() => ({
  requestMiddleware: [
    // Read per request, not at build time: `authorizedParties` only when
    // CLERK_AUTHORIZED_PARTIES is set (Production).
    clerkMiddleware(() => {
      const authorizedParties = parseAuthorizedParties(
        process.env.CLERK_AUTHORIZED_PARTIES,
      )
      return authorizedParties ? { authorizedParties } : {}
    }),
  ],
}))
