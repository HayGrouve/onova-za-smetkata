import { UserButton } from '@clerk/tanstack-react-start'
import { useHostAuth } from '#/hooks/use-host-auth.ts'
import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { useConvexAuth, useQuery } from 'convex/react'
import { ChevronLeftIcon } from 'lucide-react'
import { useMemo } from 'react'
import { AppHeaderMenu } from '#/components/layout/app-header-menu.tsx'
import {
  useBillHeaderSlot,
  useBillHeaderTitleValue,
} from '#/components/layout/bill-header-title.tsx'
import { Button } from '#/components/ui/button.tsx'
import type { BillStep } from '#/lib/bill-steps.ts'
import { getClaimHeaderBack } from '#/lib/claim-header-nav.ts'
import { useBillHeaderMenuActions } from '#/hooks/use-bill-header-menu-actions.tsx'
import {
  buildAppHeaderMenuConfig,
  shouldShowBillMenuGroup,
} from '../../../shared/app-header-menu-config.ts'
import {
  isGuestRouteContext,
  resolveAppHeaderRouteContext,
} from '../../../shared/app-header-route-context.ts'
import { getBillFinalizeEligibility } from '../../../shared/bill-finalize-eligibility.ts'
import { toBillCalculationSnapshot } from '../../../shared/bill-calculation-snapshot.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

function useHeaderConfig() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const searchStr = useRouterState({ select: (s) => s.location.searchStr })
  const params = useParams({ strict: false })
  const billId = params.billId as Id<'bills'> | undefined
  const billHeaderTitle = useBillHeaderTitleValue()
  const routeContext = resolveAppHeaderRouteContext(pathname, searchStr, billId)

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

  // `bills.get` is Host-only: a signed-out visitor on a bill route that is not
  // a known guest page must not crash the whole shell.
  const { isAuthenticated } = useConvexAuth()
  const bill = useQuery(
    api.bills.get,
    isAuthenticated && isHostBillRoute && billId ? { billId } : 'skip',
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

  if (routeContext === 'hostAccount') {
    return {
      title: 'Акаунт',
      backTo: '/' as const,
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

  if (routeContext === 'guestPay' && billId) {
    return {
      title: 'Плащане',
      backTo: null,
      backParams: undefined,
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
  const { title, backTo, backParams, backSearch, routeContext, billId, bill } =
    useHeaderConfig()
  const { isSignedIn } = useHostAuth()
  const slot = useBillHeaderSlot()

  const isGuestRoute = isGuestRouteContext(routeContext)
  const isLogin = pathname === '/login'
  // The signed-out landing page brings its own h1.
  const TitleTag = pathname === '/' && !isSignedIn ? 'p' : 'h1'
  const showHostActions = isSignedIn === true && !isGuestRoute && !isLogin

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
    <header className="sticky top-0 z-50 overflow-visible bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-2 overflow-visible px-2 sm:px-6">
        {backTo ? (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Назад"
            asChild
          >
            <Link to={backTo} params={backParams} search={backSearch}>
              <ChevronLeftIcon className="size-5" strokeWidth={1.75} />
            </Link>
          </Button>
        ) : null}
        {slot.active ? (
          // The timeline replaces the visible title; keep the page heading.
          <h1 className="sr-only">{title}</h1>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2.5 pl-1">
            {!backTo ? (
              <img
                src="/logo-96.webp"
                width={32}
                height={32}
                alt=""
                aria-hidden
                className="size-8 shrink-0 rounded-full"
              />
            ) : null}
            <TitleTag className="min-w-0 flex-1 truncate font-display text-[13px] font-bold">
              {title}
            </TitleTag>
          </div>
        )}
        {/* Bill pages portal their phase timeline here instead of a title. */}
        <div
          ref={slot.ref}
          className={slot.active ? 'min-w-0 flex-1 lg:max-w-[460px]' : 'hidden'}
        />
        {slot.active ? <div className="hidden flex-1 lg:block" /> : null}
        {showHostActions ? (
          <UserButton
            userProfileMode="navigation"
            userProfileUrl="/user-profile"
            showName={false}
          />
        ) : null}
        <AppHeaderMenu
          showHostActions={showHostActions}
          isHomeRoute={pathname === '/'}
          billMenuItems={billMenuEnabled ? billMenuItems : []}
          onBillAction={billMenuEnabled ? handleBillAction : undefined}
          billMenuDialogs={billMenuEnabled ? dialogs : undefined}
        />
      </div>
    </header>
  )
}
