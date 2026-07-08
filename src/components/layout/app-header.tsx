import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronLeftIcon, CogIcon, LogOutIcon } from 'lucide-react'
import {
  usePaymentSettingsConfigured,
} from '#/components/bills/payment-settings-open-button.tsx'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { ThemeToggle } from '#/components/layout/theme-toggle.tsx'
import { Button } from '#/components/ui/button.tsx'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

function useHeaderConfig() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const params = useParams({ strict: false })
  const billId = params.billId as Id<'bills'> | undefined
  const { isAuthenticated } = useConvexAuth()

  const isHome = pathname === '/'
  const isLogin = pathname === '/login'
  const isSummary = pathname.endsWith('/summary')
  const isJoin = pathname.endsWith('/join')
  const isClaim = pathname.endsWith('/claim')
  const isGuestRoute = isJoin || isClaim
  const isEditor =
    billId !== undefined && !isSummary && !isJoin && !isClaim

  const needsBillTitle =
    isAuthenticated && !isLogin && !isGuestRoute && billId !== undefined

  const billData = useQuery(
    api.bills.get,
    needsBillTitle && (isSummary || isEditor) ? { billId } : 'skip',
  )

  const restaurantName =
    billData?.bill.restaurantName.trim() || 'Без име'

  if (isHome) {
    return {
      title: 'Онова за сметката',
      backTo: null as string | null,
      backParams: undefined as Record<string, string> | undefined,
    }
  }

  if (isLogin) {
    return {
      title: 'Вход',
      backTo: null,
      backParams: undefined,
    }
  }

  if (isSummary && billId) {
    return {
      title: billData === undefined ? 'Зареждане…' : restaurantName,
      backTo: '/bills/$billId' as const,
      backParams: { billId },
    }
  }

  if (isJoin && billId) {
    return {
      title: 'Присъедини се',
      backTo: null,
      backParams: undefined,
    }
  }

  if (isClaim && billId) {
    return {
      title: 'Моят дял',
      backTo: null,
      backParams: undefined,
    }
  }

  if (isEditor && billId) {
    return {
      title: billData === undefined ? 'Зареждане…' : restaurantName,
      backTo: '/' as const,
      backParams: undefined,
    }
  }

  return { title: 'Онова за сметката', backTo: null, backParams: undefined }
}

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { title, backTo, backParams } = useHeaderConfig()
  const { isAuthenticated } = useConvexAuth()
  const { signOut } = useAuthActions()
  const paymentSettingsConfigured = usePaymentSettingsConfigured()
  const { openPaymentSettings } = usePaymentSettingsSheet()

  const isGuestRoute =
    pathname.endsWith('/join') || pathname.endsWith('/claim')
  const isLogin = pathname === '/login'
  const showHostActions = isAuthenticated && !isGuestRoute && !isLogin

  async function handleSignOut() {
    await signOut()
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-2 px-2">
        {backTo ? (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 tap-feedback"
            aria-label="Назад"
            asChild
          >
            <Link to={backTo} params={backParams}>
              <ChevronLeftIcon className="size-5" />
            </Link>
          </Button>
        ) : (
          <div className="size-9 shrink-0" aria-hidden />
        )}
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
          {title}
        </h1>
        <div className="flex shrink-0 items-center">
          <ThemeToggle />
          {showHostActions && paymentSettingsConfigured ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 tap-feedback"
              aria-label="Настройки за плащане"
              onClick={openPaymentSettings}
            >
              <CogIcon className="size-5" />
            </Button>
          ) : null}
          {showHostActions ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 tap-feedback"
              aria-label="Изход"
              onClick={() => void handleSignOut()}
            >
              <LogOutIcon className="size-5" />
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  )
}
