import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { DevAutoSignIn } from '#/components/auth/dev-auto-sign-in.tsx'
import { assertConvexUrlForBuild } from '#/lib/env.ts'

const convexUrl = assertConvexUrlForBuild()

const convexQueryClient = convexUrl ? new ConvexQueryClient(convexUrl) : null

function MissingConvexConfig() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg items-center justify-center px-4 text-center">
      <p className="text-sm text-muted-foreground">
        Липсва конфигурация на сървъра (VITE_CONVEX_URL).
      </p>
    </div>
  )
}

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  if (!convexQueryClient) {
    return <MissingConvexConfig />
  }

  const client = convexQueryClient.convexClient

  return (
    <ConvexAuthProvider client={client}>
      <DevAutoSignIn>{children}</DevAutoSignIn>
    </ConvexAuthProvider>
  )
}
