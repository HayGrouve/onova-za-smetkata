import { useConvexAuth } from '@convex-dev/auth/react'
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronLeftIcon } from 'lucide-react'
import { AppHeaderMenu } from '#/components/layout/app-header-menu.tsx'
import { useBillHeaderTitleValue } from '#/components/layout/bill-header-title.tsx'
import { Button } from '#/components/ui/button.tsx'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

function useHeaderConfig() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const params = useParams({ strict: false })
  const billId = params.billId as Id<'bills'> | undefined
  const billHeaderTitle = useBillHeaderTitleValue()

  const isHome = pathname === '/'
  const isLogin = pathname === '/login'
  const isSummary = pathname.endsWith('/summary')
  const isJoin = pathname.endsWith('/join')
  const isClaim = pathname.endsWith('/claim')
  const isEditor = billId !== undefined && !isSummary && !isJoin && !isClaim

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
      title: billHeaderTitle ?? 'Сметка',
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
      title: billHeaderTitle ?? 'Сметка',
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

  const isGuestRoute = pathname.endsWith('/join') || pathname.endsWith('/claim')
  const isLogin = pathname === '/login'
  const showHostActions = isAuthenticated && !isGuestRoute && !isLogin
  const viewer = useQuery(api.users.viewer, showHostActions ? {} : 'skip')

  return (
    <header className="sticky-surface sticky top-0 z-50 border-b pt-[env(safe-area-inset-top)]">
      <div className="page-shell flex h-14 items-center gap-2">
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
        ) : pathname !== '/' ? (
          <div className="size-9 shrink-0" aria-hidden />
        ) : null}
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
          {title}
        </h1>
        <AppHeaderMenu
          showHostActions={showHostActions}
          viewerLabel={viewer?.label}
          viewerEmail={viewer?.email}
        />
      </div>
    </header>
  )
}
