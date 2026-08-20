import { UserProfile } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2Icon } from 'lucide-react'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { ICON } from '#/lib/app-icons.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

export const Route = createFileRoute('/user-profile/$')({
  head: () => buildNoIndexHead('Акаунт'),
  component: HostAccountPage,
})

function HostAccountFallback() {
  return (
    <div className="flex flex-1 items-center justify-center py-10 text-muted-foreground">
      <Loader2Icon className={`${ICON.button} mr-2 animate-spin`} aria-hidden />
      Зареждане...
    </div>
  )
}

function HostAccountPage() {
  const { isAuthenticated, isLoading: authLoading } =
    useRequireHostAuth('/user-profile')

  if (authLoading || !isAuthenticated) {
    return <HostAccountFallback />
  }

  return (
    <div className="host-account-clerk">
      <UserProfile
        routing="path"
        path="/user-profile"
        apiKeysProps={{ hide: true }}
        fallback={<HostAccountFallback />}
      />
    </div>
  )
}
