import type { AuthConfig } from 'convex/server'

// `customJwt` (not `domain`) so every non registered claim reaches
// `ctx.auth.getUserIdentity()`, including `azp`, which convex/lib/auth.ts
// checks against CLERK_AUTHORIZED_PARTIES.
export default {
  providers: [
    {
      type: 'customJwt',
      issuer: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      jwks: `${process.env.CLERK_JWT_ISSUER_DOMAIN}/.well-known/jwks.json`,
      algorithm: 'RS256',
      applicationID: 'convex',
    },
  ],
} satisfies AuthConfig
