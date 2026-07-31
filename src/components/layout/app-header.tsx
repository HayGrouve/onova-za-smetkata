import { useAuth } from '@clerk/tanstack-react-start'
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronLeftIcon } from 'lucide-react'
import { useMemo } from 'react'
import { AppHeaderMenu } from '#/components/layout/app-header-menu.tsx'
import { useBillHeaderTitleValue } from '#/components/layout/bill-header-title.tsx'
import { Button } from '#/components/ui/button.tsx'
import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import { getClaimHeaderBack } from '#/lib/claim-header-nav.ts'
import { useBillHeaderMenuActions } from '#/hooks/use-bill-header-menu-actions.tsx'
import {
  buildAppHeaderMenuConfig,
  shouldShowBillMenuGroup,
} from '../../../shared/app-header-menu-config.ts'
import type { AppHeaderRouteContext } from '../../../shared/app-header-menu-config.ts'
import { getBillFinalizeEligibility } from '../../../shared/bill-finalize-eligibility.ts'
import { toBillCalculationSnapshot } from '#/lib/bill-calculation-snapshot.ts'
import { useViewerNowMs } from '#/hooks/use-viewer-now-ms.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

function resolveRouteContext(
  pathname: string,
  searchStr: string,
  billId: Id<'bills'> | undefined,
): AppHeaderRouteContext {
  if (pathname === '/') return 'home'
  if (pathname === '/login') return 'login'
  if (!billId) return 'home'

  const isSummary = pathname.endsWith('/summary')
  const isJoin = pathname.endsWith('/join')
  const isClaim = pathname.endsWith('/claim')
  const claimMode = new URLSearchParams(searchStr).get('mode')

  if (isJoin) return 'guestJoin'
  if (isClaim && claimMode !== 'host') return 'guestClaim'
  if (isClaim && claimMode === 'host') return 'hostClaim'
  if (isSummary) return 'summary'
  return 'editor'
}

function useHeaderConfig() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const searchStr = useRouterState({ select: (s) => s.location.searchStr })
  const params = useParams({ strict: false })
  const billId = params.billId as Id<'bills'> | undefined
  const billHeaderTitle = useBillHeaderTitleValue()
  const routeContext = resolveRouteContext(pathname, searchStr, billId)

  const isHome = pathname === '/'
  const isLogin = pathname === '/login'
  const isSummary = routeContext === 'summary'
  const isJoin = routeContext === 'guestJoin'
  const isClaim = pathname.endsWith('/claim')
  const isEditor = routeContext === 'editor'
  const isHostClaim = routeContext === 'hostClaim'

  const isHostBillRoute =
    routeContext === 'editor' ||
    routeContext === 'summary' ||
    routeContext === 'hostClaim'

  const bill = useQuery(
    api.bills.get,
    isHostBillRoute && billId ? { billId } : 'skip',
  )

  if (isHome) {
    return {
      title: 'Онова за сметката',
      backTo: null as string | null,
      backParams: undefined as Record<string, string> | undefined,
      backSearch: undefined as { step: BillStep } | undefined,
      routeContext,
      billId,
      bill,
    }
  }

  if (isLogin) {
    return {
      title: 'Вход',
      backTo: null,
      backParams: undefined,
      backSearch: undefined,
      routeContext,
      billId,
      bill,
    }
  }

  if (isSummary && billId) {
    const isDraft = bill?.bill.status === 'draft'
    return {
      title: billHeaderTitle ?? 'Сметка',
      backTo: isDraft ? ('/bills/$billId' as const) : ('/' as const),
      backParams: isDraft ? { billId } : undefined,
      backSearch: undefined,
      routeContext,
      billId,
      bill,
    }
  }

  if (isJoin && billId) {
    return {
      title: 'Присъедини се',
      backTo: null,
      backParams: undefined,
      backSearch: undefined,
      routeContext,
      billId,
      bill,
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
        routeContext,
        billId,
        bill,
      }
    }
    return {
      title: 'Моят дял',
      backTo: null,
      backParams: undefined,
      backSearch: undefined,
      routeContext,
      billId,
      bill,
    }
  }

  if (isEditor && billId) {
    return {
      title: billHeaderTitle ?? 'Сметка',
      backTo: '/' as const,
      backParams: undefined,
      backSearch: undefined,
      routeContext,
      billId,
      bill,
    }
  }

  return {
    title: 'Онова за сметката',
    backTo: null,
    backParams: undefined,
    backSearch: undefined,
    routeContext,
    billId,
    bill,
  }
}

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const searchStr = useRouterState({ select: (s) => s.location.searchStr })
  const { title, backTo, backParams, backSearch, routeContext, billId, bill } =
    useHeaderConfig()
  const { isSignedIn } = useAuth()

  const isHostClaim =
    pathname.endsWith('/claim') &&
    new URLSearchParams(searchStr).get('mode') === 'host'
  const isGuestRoute =
    pathname.endsWith('/join') || (pathname.endsWith('/claim') && !isHostClaim)
  const isLogin = pathname === '/login'
  const showHostActions = isSignedIn && !isGuestRoute && !isLogin
  const viewerNowMs = useViewerNowMs()
  const viewer = useQuery(
    api.users.viewer,
    showHostActions ? { nowMs: viewerNowMs } : 'skip',
  )

  const billMenuEligibility = useMemo(() => {
    if (!bill || !showHostActions) {
      return {
        finalizeValidationPasses: false,
        unpaidCount: 0,
      }
    }
    const snapshot = toBillCalculationSnapshot(
      {
        participants: bill.participants,
        items: bill.items,
        assignments: bill.assignments,
        payments: bill.payments,
      },
      {
        tipCents: bill.bill.tipCents ?? 0,
        hostParticipantId: bill.bill.hostParticipantId,
      },
    )
    return getBillFinalizeEligibility({
      restaurantName: bill.bill.restaurantName,
      snapshot,
      participants: bill.participants,
      hostParticipantId: bill.bill.hostParticipantId,
    })
  }, [bill, showHostActions])

  const billMenuItems = useMemo(() => {
    if (!showHostActions || !billId) return []
    return buildAppHeaderMenuConfig({
      routeContext,
      billStatus: bill?.bill.status,
      participantCount: bill?.participants.length ?? 0,
      finalizeValidationPasses: billMenuEligibility.finalizeValidationPasses,
      unpaidCount: billMenuEligibility.unpaidCount,
    })
  }, [bill, billId, billMenuEligibility, routeContext, showHostActions])

  const { handleBillAction, dialogs } = useBillHeaderMenuActions({
    billId,
    billData: bill,
    unpaidCount: billMenuEligibility.unpaidCount,
  })

  const billMenuEnabled =
    showHostActions &&
    billId !== undefined &&
    shouldShowBillMenuGroup(routeContext) &&
    bill !== undefined

  return (
    <header className="sticky-surface sticky top-0 z-50 overflow-visible border-b pt-[env(safe-area-inset-top)]">
      <div className="page-shell flex h-14 items-center gap-2 overflow-visible">
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
        ) : null}
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-visible">
          {!backTo ? (
            <div className="shrink-0 self-end">
              <img
                src="/logo.png"
                alt=""
                aria-hidden
                className="relative z-10 size-14 translate-y-3 rounded-full ring-2 ring-background shadow-sm"
              />
            </div>
          ) : null}
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold">
            {title}
          </h1>
        </div>
        <AppHeaderMenu
          showHostActions={showHostActions}
          isHomeRoute={pathname === '/'}
          viewerLabel={viewer?.label}
          viewerEmail={viewer?.email}
          billMenuItems={billMenuEnabled ? billMenuItems : []}
          onBillAction={billMenuEnabled ? handleBillAction : undefined}
          billMenuDialogs={billMenuEnabled ? dialogs : undefined}
        />
      </div>
    </header>
  )
}
