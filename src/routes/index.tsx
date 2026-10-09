import { Component, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { LandingPage } from '#/components/landing/landing-page.tsx'
import { ReceiptLoading } from '#/components/receipt/receipt-states.tsx'
import { useAuth } from '@clerk/tanstack-react-start'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { CameraIcon, Loader2Icon, PlusIcon } from 'lucide-react'
import {
  PaymentSettingsOpenButton,
  usePaymentSettingsStatus,
} from '#/components/bills/payment-settings-open-button.tsx'
import { usePaymentSettingsSheet } from '#/components/bills/payment-settings-provider.tsx'
import { BillHistory } from '#/components/home/bill-history.tsx'
import { DebtorsList } from '#/components/home/debtors-list.tsx'
import { OpenBillsList } from '#/components/home/open-bills-list.tsx'
import { OwedSummaryCard } from '#/components/home/owed-summary-card.tsx'
import { QuickBillResume } from '#/components/quick-bill/quick-bill-resume.tsx'
import { QuickCameraButton } from '#/components/quick-bill/quick-camera-button.tsx'
import { Button } from '#/components/ui/button.tsx'
import { QueryErrorPanel } from '#/components/ui/query-error-panel.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import { useSubscriptionPaywall } from '#/components/subscription/subscription-provider.tsx'
import { PwaInstallBanner } from '#/components/pwa-install-banner.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { buildHomeHead, buildHomeStructuredData } from '#/lib/site-meta.ts'
import { cn } from '#/lib/utils.ts'
import { useHostOnboarding } from '#/components/host-onboarding/host-onboarding-provider.tsx'
import { HOST_ONBOARDING_HOME } from '../../shared/host-onboarding-messages.ts'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/')({
  head: () => ({
    ...buildHomeHead(),
    scripts: [
      { type: 'application/ld+json', children: buildHomeStructuredData() },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q:
      typeof search.q === 'string' && search.q.trim()
        ? search.q.trim()
        : undefined,
  }),
  component: HomeGate,
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

/**
 * `/` is the signed-out front door and the signed-in Host's Home. Clerk's
 * session is read on the server (`clerkMiddleware`) and handed to the browser
 * as initial state, so `isLoaded` is already true during SSR: a signed-out
 * request is answered with the landing page's HTML, and a signed-in Host
 * never sees it. Only a browser Clerk has not loaded yet shows the skeleton.
 */
function HomeGate() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) return <ReceiptLoading />
  if (!isSignedIn) return <LandingPage />
  return <Home />
}

function Home() {
  const navigate = useNavigate()
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
  const onboarding = useQuery(api.hostOnboarding.getForViewer, {})

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
    } catch (error) {
      // A guided bill counts against the monthly quota like any other.
      if (!handleMutationError(error)) {
        toast.error('Неуспешно създаване на сметка')
      }
    } finally {
      setIsCreating(false)
    }
  }

  const showResumeGuidedBill =
    onboarding?.lifecycle === 'active' && resumeGuidedBillId !== undefined

  const creatingSpinner = (
    <Loader2Icon
      className={cn(ICON.button, 'animate-spin motion-reduce:animate-none')}
      aria-hidden
    />
  )

  const actions = (
    <div className="flex flex-col gap-2 sm:max-w-[360px]">
      <PwaInstallBanner />
      {paymentSettingsStatus === 'unconfigured' ? (
        <PaymentSettingsOpenButton onClick={openPaymentSettings} />
      ) : null}

      {showResumeGuidedBill ? (
        <Button onClick={() => void handleResumeGuidedBill()}>
          {HOST_ONBOARDING_HOME.resumeGuidedBill}
        </Button>
      ) : null}

      {needsAnotherGuidedBill ? (
        <Button
          disabled={isCreating}
          onClick={() => void handleStartAnotherGuidedBill()}
        >
          {isCreating ? creatingSpinner : null}
          {HOST_ONBOARDING_HOME.startNewGuidedBill}
        </Button>
      ) : null}

      {onboarding?.lifecycle === 'active' ? (
        <Button variant="ghost" onClick={() => void stopGuidance()}>
          {HOST_ONBOARDING_HOME.stopGuidance}
        </Button>
      ) : null}

      <Button
        size="lg"
        variant={
          showResumeGuidedBill || needsAnotherGuidedBill ? 'outline' : 'default'
        }
        onClick={handleCreateBill}
        disabled={isCreating}
      >
        {isCreating ? (
          creatingSpinner
        ) : (
          <PlusIcon strokeWidth={2} aria-hidden />
        )}
        Нова сметка
      </Button>

      <QuickBillResume />
      <QuickCameraButton
        mode="new"
        size="lg"
        variant="outline"
        disabled={isCreating}
        onStarted={() => void navigate({ to: '/quick-bill', search: {} })}
      >
        <CameraIcon strokeWidth={2} aria-hidden />
        Бърза сметка
      </QuickCameraButton>
      <p className="-mt-1 text-[11px] leading-relaxed text-on-table-muted">
        Чисти сметки, добри приятели.
      </p>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pt-5 pb-24 sm:px-6 lg:pt-10">
      <HomeSectionErrorBoundary
        resetKey={resetKey}
        onRetry={() => setResetKey((n) => n + 1)}
      >
        <CollectionOverview key={resetKey} actions={actions} />
      </HomeSectionErrorBoundary>
    </div>
  )
}

/**
 * The receipt shelf: what is still out there, the live receipts on top, and
 * older bills as stamped stubs.
 */
function CollectionOverview({ actions }: { actions: ReactNode }) {
  const overview = useQuery(api.bills.homeOverview, {})

  // Unfinished drafts have no settled Shares yet; the money line only makes
  // sense once at least one bill is collecting or ready to close.
  const hasPreparedBill =
    overview?.openBills.some((bill) => bill.nextAction !== 'finish') ?? false

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16">
      <div className="flex flex-col gap-8">
        {overview === undefined ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-11 w-48" />
          </div>
        ) : hasPreparedBill ? (
          <OwedSummaryCard
            owedCents={overview.owedCents}
            collectedCents={overview.collectedCents}
            debtorCount={overview.debtors.length}
            owingBillCount={overview.owingBillCount}
          />
        ) : (
          <section aria-label="Онова за сметката">
            <p className="font-display text-[26px] leading-tight font-bold sm:text-[32px]">
              Безплатен обяд няма!
            </p>
            <p className="mt-2 max-w-[36ch] text-[12px] leading-relaxed text-on-table-muted">
              Снимате бележката, пращате линка в групата, всеки отбелязва своето
              и плаща.
            </p>
          </section>
        )}
        {actions}
        {overview ? <DebtorsList debtors={overview.debtors} /> : null}
      </div>
      <div className="flex flex-col gap-10">
        {overview === undefined ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-busy>
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <OpenBillsList
            bills={overview.openBills}
            truncated={overview.truncated}
          />
        )}
        <BillHistory />
      </div>
    </div>
  )
}
