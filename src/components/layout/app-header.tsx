import { Link, useParams, useRouterState } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ChevronLeftIcon, CogIcon } from 'lucide-react'
import {
  usePaymentSettingsConfigured,
} from '#/components/bills/payment-settings-open-button.tsx'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

function useHeaderConfig() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const params = useParams({ strict: false })
  const billId = params.billId as Id<'bills'> | undefined

  const billData = useQuery(
    api.bills.get,
    billId ? { billId } : 'skip',
  )

  const isHome = pathname === '/'
  const isSummary = pathname.endsWith('/summary')
  const isEditor = billId !== undefined && !isSummary

  const restaurantName =
    billData?.bill.restaurantName.trim() || 'Без име'

  if (isHome) {
    return {
      title: 'Онова за сметката',
      backTo: null as string | null,
      backParams: undefined as Record<string, string> | undefined,
    }
  }

  if (isSummary && billId) {
    return {
      title: billData === undefined ? 'Зареждане…' : restaurantName,
      backTo: '/bills/$billId' as const,
      backParams: { billId },
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
  const { title, backTo, backParams } = useHeaderConfig()
  const paymentSettingsConfigured = usePaymentSettingsConfigured()
  const { openPaymentSettings } = usePaymentSettingsSheet()

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
        {paymentSettingsConfigured ? (
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
        ) : (
          <div className="size-9 shrink-0" aria-hidden />
        )}
      </div>
    </header>
  )
}
