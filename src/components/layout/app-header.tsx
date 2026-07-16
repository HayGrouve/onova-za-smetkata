import { useConvexAuth } from '@convex-dev/auth/react'
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronLeftIcon } from 'lucide-react'
import { AppHeaderMenu } from '#/components/layout/app-header-menu.tsx'
import { useBillHeaderTitleValue } from '#/components/layout/bill-header-title.tsx'
import { Button } from '#/components/ui/button.tsx'
import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import { getClaimHeaderBack } from '#/lib/claim-header-nav.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

function useHeaderConfig() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const searchStr = useRouterState({ select: (s) => s.location.searchStr })
  const params = useParams({ strict: false })
  const billId = params.billId as Id<'bills'> | undefined
  const billHeaderTitle = useBillHeaderTitleValue()

  const isHome = pathname === '/'
  const isLogin = pathname === '/login'
  const isSummary = pathname.endsWith('/summary')
  const isJoin = pathname.endsWith('/join')
  const isClaim = pathname.endsWith('/claim')
  const isEditor = billId !== undefined && !isSummary && !isJoin && !isClaim
  const claimMode = new URLSearchParams(searchStr).get('mode')
  const isHostClaim = isClaim && claimMode === 'host'

  const bill = useQuery(
    api.bills.get,
    isSummary && billId ? { billId } : 'skip',
  )

  if (isHome) {
    return {
      title: 'Онова за сметката',
      backTo: null as string | null,
      backParams: undefined as Record<string, string> | undefined,
      backSearch: undefined as { step: BillStep } | undefined,
    }
  }

  if (isLogin) {
    return {
      title: 'Вход',
      backTo: null,
      backParams: undefined,
      backSearch: undefined,
    }
  }

  if (isSummary && billId) {
    const isDraft = bill?.bill.status === 'draft'
    return {
      title: billHeaderTitle ?? 'Сметка',
      backTo: isDraft ? ('/bills/$billId' as const) : ('/' as const),
      backParams: isDraft ? { billId } : undefined,
      backSearch: undefined,
    }
  }

  if (isJoin && billId) {
    return {
      title: 'Присъедини се',
      backTo: null,
      backParams: undefined,
      backSearch: undefined,
    }
  }

  if (isClaim && billId) {
    const hostBack = getClaimHeaderBack({
      billId,
      mode: isHostClaim ? 'host' : undefined,
    })
    if (hostBack) {
      return {
        title: 'Моите артикули',
        backTo: hostBack.backTo,
        backParams: hostBack.backParams,
        backSearch: hostBack.backSearch,
      }
    }
    return {
      title: 'Моят дял',
      backTo: null,
      backParams: undefined,
      backSearch: undefined,
    }
  }

  if (isEditor && billId) {
    return {
      title: billHeaderTitle ?? 'Сметка',
      backTo: '/' as const,
      backParams: undefined,
      backSearch: undefined,
    }
  }

  return {
    title: 'Онова за сметката',
    backTo: null,
    backParams: undefined,
    backSearch: undefined,
  }
}

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const searchStr = useRouterState({ select: (s) => s.location.searchStr })
  const { title, backTo, backParams, backSearch } = useHeaderConfig()
  const { isAuthenticated } = useConvexAuth()

  const isHostClaim =
    pathname.endsWith('/claim') &&
    new URLSearchParams(searchStr).get('mode') === 'host'
  const isGuestRoute =
    pathname.endsWith('/join') || (pathname.endsWith('/claim') && !isHostClaim)
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
            <Link to={backTo} params={backParams} search={backSearch}>
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
