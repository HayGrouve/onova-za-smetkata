import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SignIn, useAuth } from '@clerk/tanstack-react-start'
import { useEffect } from 'react'
import { buildNoIndexHead } from '#/lib/site-meta.ts'

export const Route = createFileRoute('/login')({
  head: () => buildNoIndexHead('Вход'),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect:
      typeof search.redirect === 'string' && search.redirect.startsWith('/')
        ? search.redirect
        : '/',
  }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  const { isSignedIn, isLoaded } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void navigate({ to: redirect })
    }
  }, [isLoaded, isSignedIn, navigate, redirect])

  if (!isLoaded || isSignedIn) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  return (
    <div className="page-container flex min-h-[70dvh] flex-col justify-center gap-6 py-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-xl font-semibold">Онова за сметката</h1>
        <p className="text-sm text-muted-foreground">
          Влезте, за да управлявате вашите сметки. Гостите на масата продължават
          да използват QR линка без вход.
        </p>
      </div>

      <SignIn
        routing="hash"
        forceRedirectUrl={redirect}
        fallbackRedirectUrl={redirect}
      />

      <p className="text-center text-xs text-muted-foreground">
        <Link
          to="/privacy"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Поверителност
        </Link>
        {' · '}
        <Link
          to="/terms"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Условия
        </Link>
      </p>
    </div>
  )
}
