import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { Separator } from '#/components/ui/separator.tsx'
import { isClientDevMode } from '#/lib/dev-mode.ts'
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
  const devMode = isClientDevMode()
  const { isAuthenticated, isLoading } = useConvexAuth()
  const { signIn } = useAuthActions()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      void navigate({ to: redirect })
    }
  }, [isAuthenticated, isLoading, navigate, redirect])

  async function handleGoogleSignIn() {
    setIsSubmitting(true)
    try {
      await signIn('google', { redirectTo: redirect })
    } catch {
      toast.error('Неуспешен вход с Google')
      setIsSubmitting(false)
    }
  }

  async function handleEmailSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return

    setIsSubmitting(true)
    try {
      await signIn('resend', { email: trimmed, redirectTo: redirect })
      setEmailSent(true)
    } catch {
      toast.error('Неуспешно изпращане на линк за вход')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || isAuthenticated) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  if (devMode) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Влизане като dev потребител...
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

      <Button
        type="button"
        className="h-11 w-full"
        disabled={isSubmitting}
        onClick={() => void handleGoogleSignIn()}
      >
        Вход с Google
      </Button>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">или</span>
        <Separator className="flex-1" />
      </div>

      {emailSent ? (
        <p className="text-center text-sm text-muted-foreground">
          Проверете пощата си за линк за вход.
        </p>
      ) : (
        <form className="flex flex-col gap-3" onSubmit={handleEmailSignIn}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="login-email">Имейл адрес</Label>
            <Input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Имейл адрес"
              className="h-11"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            className="h-11 w-full"
            disabled={isSubmitting || !email.trim()}
          >
            Изпрати линк за вход
          </Button>
        </form>
      )}
    </div>
  )
}
