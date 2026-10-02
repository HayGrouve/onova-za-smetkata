import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { SignIn, useAuth } from '@clerk/tanstack-react-start'
import { useEffect } from 'react'
import { ReceiptLoading } from '#/components/receipt/receipt-states.tsx'
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
    return <ReceiptLoading lines={3} />
  }

  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center gap-6 px-3 py-8 sm:pt-12">
      <div className="flex flex-col gap-2 text-center">
        <p className="font-display text-[26px] leading-tight font-bold">
          Влезте, за да разделите сметката
        </p>
        <p className="text-[12px] leading-relaxed text-on-table-muted">
          Вход е нужен само на домакина. Гостите на масата отварят линка или QR
          кода без регистрация.
        </p>
      </div>

      <SignIn
        routing="hash"
        forceRedirectUrl={redirect}
        fallbackRedirectUrl={redirect}
      />

      <p className="text-center text-[11px] text-on-table-muted">
        <Link
          to="/privacy"
          className="text-on-table underline decoration-dotted decoration-2 underline-offset-4"
        >
          Поверителност
        </Link>
        {' · '}
        <Link
          to="/terms"
          className="text-on-table underline decoration-dotted decoration-2 underline-offset-4"
        >
          Условия
        </Link>
      </p>
    </div>
  )
}
