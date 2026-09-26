import { Component, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { PlusIcon } from 'lucide-react'
import {
  PaymentSettingsOpenButton,
  usePaymentSettingsStatus,
} from '#/components/bills/payment-settings-open-button.tsx'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { BillHistory } from '#/components/home/bill-history.tsx'
import { DebtorsList } from '#/components/home/debtors-list.tsx'
import { OpenBillsList } from '#/components/home/open-bills-list.tsx'
import { OwedSummaryCard } from '#/components/home/owed-summary-card.tsx'
import { Button } from '#/components/ui/button.tsx'
import { QueryErrorPanel } from '#/components/ui/query-error-panel.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { useSubscriptionPaywall } from '#/components/subscription/subscription-provider.tsx'
import { PwaInstallBanner } from '#/components/pwa-install-banner.tsx'
import { buildHomeHead } from '#/lib/site-meta.ts'
import { useHostOnboarding } from '#/components/host-onboarding/host-onboarding-provider.tsx'
import { HOST_ONBOARDING_HOME } from '../../shared/host-onboarding-messages.ts'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/')({
  head: () => buildHomeHead(),
  component: Home,
})

class HomeSectionErrorBoundary extends Component<
  {
    resetKey: number
    onRetry: () => void
    children: ReactNode
  },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Home failed to load', error, info)
    toast.error('Неуспешно зареждане на сметките')
  }

  componentDidUpdate(prevProps: { resetKey: number }) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <QueryErrorPanel
          message="Неуспешно зареждане."
          onRetry={this.props.onRetry}
        />
      )
    }
    return this.props.children
  }
}

function Home() {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useRequireHostAuth('/')
  const { handleMutationError } = useSubscriptionPaywall()
  const createBill = useMutation(api.bills.create)
  const [resetKey, setResetKey] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const paymentSettingsStatus = usePaymentSettingsStatus()
  const { openPaymentSettings } = usePaymentSettingsSheet()
  const { resumeGuidedBillId, needsAnotherGuidedBill, stopGuidance } =
    useHostOnboarding()
  const startAnotherGuidedBill = useMutation(
    api.hostOnboarding.startAnotherGuidedBill,
  )
  const onboarding = useQuery(
    api.hostOnboarding.getForViewer,
    isAuthenticated ? {} : 'skip',
  )

  if (isLoading || !isAuthenticated) {
    return (
      <div className="page-container py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  async function handleCreateBill() {
    setIsCreating(true)
    try {
      const billId = await createBill()
      await navigate({
        to: '/bills/$billId',
        params: { billId },
        search: { step: 1 },
      })
    } catch (error) {
      if (!handleMutationError(error)) {
        toast.error('Неуспешно създаване на сметка')
      }
    } finally {
      setIsCreating(false)
    }
  }

  async function handleResumeGuidedBill() {
    if (!resumeGuidedBillId) return
    await navigate({
      to: '/bills/$billId',
      params: { billId: resumeGuidedBillId },
      search: { step: 1 },
    })
  }

  async function handleStartAnotherGuidedBill() {
    setIsCreating(true)
    try {
      const billId = await startAnotherGuidedBill({})
      await navigate({
        to: '/bills/$billId',
        params: { billId },
        search: { step: 1 },
      })
    } catch {
      toast.error('Неуспешно създаване на сметка')
    } finally {
      setIsCreating(false)
    }
  }

  const showResumeGuidedBill =
    onboarding?.lifecycle === 'active' && resumeGuidedBillId !== undefined

  return (
    <div className="page-container flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <PwaInstallBanner />
        {paymentSettingsStatus === 'unconfigured' ? (
          <PaymentSettingsOpenButton onClick={openPaymentSettings} />
        ) : null}

        {showResumeGuidedBill ? (
          <Button
            className="h-11 w-full"
            onClick={() => void handleResumeGuidedBill()}
          >
            {HOST_ONBOARDING_HOME.resumeGuidedBill}
          </Button>
        ) : null}

        {needsAnotherGuidedBill ? (
          <Button
            className="h-11 w-full"
            disabled={isCreating}
            onClick={() => void handleStartAnotherGuidedBill()}
          >
            {HOST_ONBOARDING_HOME.startNewGuidedBill}
          </Button>
        ) : null}

        {onboarding?.lifecycle === 'active' ? (
          <Button
            variant="ghost"
            className="h-10 w-full text-muted-foreground"
            onClick={() => void stopGuidance()}
          >
            {HOST_ONBOARDING_HOME.stopGuidance}
          </Button>
        ) : null}

        <Button
          className="h-11 w-full"
          onClick={handleCreateBill}
          disabled={isCreating}
        >
          <PlusIcon /> Нова сметка
        </Button>
      </div>

      <HomeSectionErrorBoundary
        resetKey={resetKey}
        onRetry={() => setResetKey((n) => n + 1)}
      >
        <div key={resetKey} className="flex flex-col gap-6">
          <CollectionOverview />
          <BillHistory />
        </div>
      </HomeSectionErrorBoundary>
    </div>
  )
}

/** Money still owed across open bills, who owes it, and what to do next. */
function CollectionOverview() {
  const overview = useQuery(api.bills.homeOverview, {})

  if (overview === undefined) {
    return (
      <div className="flex flex-col gap-3" aria-busy>
        <Skeleton className="h-36 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    )
  }

  if (overview.openBills.length === 0) return null

  // Unfinished drafts have no settled Shares yet — the money card only makes
  // sense once at least one bill is collecting or ready to close.
  const hasPreparedBill = overview.openBills.some(
    (bill) => bill.nextAction !== 'finish',
  )

  return (
    <>
      {hasPreparedBill ? (
        <OwedSummaryCard
          owedCents={overview.owedCents}
          collectedCents={overview.collectedCents}
          debtorCount={overview.debtors.length}
          owingBillCount={overview.owingBillCount}
        />
      ) : null}
      <DebtorsList debtors={overview.debtors} />
      <OpenBillsList
        bills={overview.openBills}
        truncated={overview.truncated}
      />
    </>
  )
}
