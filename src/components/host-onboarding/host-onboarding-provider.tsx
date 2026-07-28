import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { useConfirmAction } from '#/components/confirm-action-provider.tsx'
import { usePaymentSettings } from '#/components/bills/payment-settings-provider.tsx'
import { BILL_STEP_LABELS } from '#/components/bills/bill-steps-bar.tsx'
import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import { WelcomeSheet } from '#/components/host-onboarding/welcome-sheet.tsx'
import { PaymentCheckpointSheet } from '#/components/host-onboarding/payment-checkpoint-sheet.tsx'
import { Button } from '#/components/ui/button.tsx'
import { getStopGuidanceCopy } from '#/lib/destructive-action-copy.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import {
  clearHostOnboardingSession,
  deferWelcomeThisSession,
  dismissHandoffThisSession,
  dismissHintThisSession,
  isHandoffDismissedThisSession,
  isReplayActiveThisSession,
  isWelcomeDeferredThisSession,
  readContentRoute,
  readDismissedHintIds,
  saveContentRoute,
  clearAllDismissedHintsThisSession,
  startReplayThisSession,
} from '#/lib/host-onboarding-session.ts'
import { shareLink } from '#/lib/share-link.ts'
import type { ShareLinkResult } from '#/lib/share-link.ts'
import {
  deriveHostOnboardingGuidance,
  guidanceForEditorStep,
  isEligibleForAutomaticOnboarding,
  stepBarGuidanceLabel,
} from '../../../shared/host-onboarding.ts'
import type {
  GuidanceAnchor,
  GuidanceStep,
  HostOnboardingContentRoute,
} from '../../../shared/host-onboarding.ts'
import {
  HOST_ONBOARDING_HANDOFF,
  HOST_ONBOARDING_HOME,
  HOST_ONBOARDING_STEP_BAR,
} from '../../../shared/host-onboarding-messages.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export type GuidanceSlot = (anchor: GuidanceAnchor) => ReactNode

export type StepBarSignal =
  | { kind: 'on' }
  | { kind: 'pointer'; step: BillStep; label: string; actionLabel: string }

export interface BillGuidanceInput {
  billId: Id<'bills'>
  step: BillStep
  restaurantName: string
  restaurantFromOcr: boolean
  hostParticipantName: string
  guestCount: number
  items: { id: string; unitPriceCents: number; quantity: number }[]
  assignments: {
    itemId: string
    participantId: string
    unitIndex: number
  }[]
  receiptUploaded: boolean
  receiptScanning: boolean
  scanReviewOpen: boolean
}

interface HostOnboardingContextValue {
  showWelcome: boolean
  dismissWelcome: () => void
  resumeGuidedBillId: Id<'bills'> | undefined
  needsAnotherGuidedBill: boolean
  guidanceOnForBill: (billId: Id<'bills'>) => boolean
  makeGuidanceSlot: (input: BillGuidanceInput) => GuidanceSlot
  getStepBarSignal: (input: BillGuidanceInput) => StepBarSignal | null
  interceptGuestShare: (
    billId: Id<'bills'>,
    joinUrl: string,
  ) => Promise<boolean>
  stopGuidance: () => Promise<void>
  startReplay: () => void
  chooseContentRoute: (
    billId: Id<'bills'>,
    route: HostOnboardingContentRoute,
  ) => void
  getContentRoute: (
    billId: Id<'bills'>,
  ) => HostOnboardingContentRoute | undefined
  refreshBillSession: () => void
  /** DEV only — reset state and open the welcome sheet for manual first-run testing. */
  triggerFirstRunForDevTesting: () => Promise<void>
}

const HostOnboardingContext = createContext<HostOnboardingContextValue | null>(
  null,
)

export function HostOnboardingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth()
  const onboarding = useQuery(
    api.hostOnboarding.getForViewer,
    isAuthenticated ? {} : 'skip',
  )
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : 'skip')
  const createFirstBill = useMutation(api.hostOnboarding.createFirstBill)
  const startGuidedBillWithExistingBills = useMutation(
    api.hostOnboarding.startGuidedBillWithExistingBills,
  )
  const skipOnboarding = useMutation(api.hostOnboarding.skip)
  const dismissCheckpoint = useMutation(
    api.hostOnboarding.dismissPaymentCheckpoint,
  )
  const recordShared = useMutation(api.hostOnboarding.recordShared)
  const resetForDevTesting = useMutation(api.hostOnboarding.resetForDevTesting)
  const { confirm } = useConfirmAction()
  const { status: paymentStatus } = usePaymentSettings()

  const [welcomeStage, setWelcomeStage] = useState<'intro' | 'name'>('intro')
  const [welcomeForcedOpen, setWelcomeForcedOpen] = useState(false)
  const [checkpointOpen, setCheckpointOpen] = useState(false)
  const [pendingShare, setPendingShare] = useState<{
    billId: Id<'bills'>
    joinUrl: string
  } | null>(null)
  const [billSessionVersion, setBillSessionVersion] = useState(0)
  const [replayActive, setReplayActive] = useState(isReplayActiveThisSession)

  const refreshBillSession = useCallback(() => {
    setBillSessionVersion((value) => value + 1)
  }, [])

  const eligibleForWelcome = useMemo(() => {
    if (!onboarding) return false
    return (
      isEligibleForAutomaticOnboarding({
        lifecycle: onboarding.lifecycle,
        billCount: onboarding.billCount,
      }) && !isWelcomeDeferredThisSession()
    )
  }, [onboarding])

  const showWelcome =
    welcomeForcedOpen ||
    (eligibleForWelcome && onboarding?.lifecycle === 'notStarted')

  const guidanceOnForBill = useCallback(
    (billId: Id<'bills'>) => {
      if (replayActive) return true
      if (!onboarding) return false
      if (onboarding.lifecycle !== 'active') return false
      if (onboarding.guidedBillId === undefined) return false
      return onboarding.guidedBillId === billId
    },
    [onboarding, replayActive],
  )

  const buildGuidance = useCallback(
    (input: BillGuidanceInput) => {
      void billSessionVersion
      const dismissedHintIds = readDismissedHintIds(input.billId)
      const steps = deriveHostOnboardingGuidance({
        bill: {
          restaurantName: input.restaurantName,
          restaurantFromOcr: input.restaurantFromOcr,
          hostParticipantName: input.hostParticipantName,
          guestCount: input.guestCount,
          items: input.items,
          assignments: input.assignments,
          contentRoute: readContentRoute(input.billId),
          receiptUploaded: input.receiptUploaded,
          receiptScanning: input.receiptScanning,
          scanReviewOpen: input.scanReviewOpen,
          sharedAt: onboarding?.sharedAt,
        },
        dismissedHintIds,
      })
      return { steps, dismissedHintIds }
    },
    [billSessionVersion, onboarding?.sharedAt],
  )

  const performShare = useCallback(
    async (billId: Id<'bills'>, joinUrl: string): Promise<boolean> => {
      const result: ShareLinkResult = await shareLink({
        url: joinUrl,
        title: 'Онова за сметката',
      })
      if (result === 'shared' || result === 'copied') {
        toast.success(
          result === 'shared' ? 'Линкът е споделен' : 'Линкът е копиран',
        )
        if (guidanceOnForBill(billId)) {
          await recordShared({ billId })
        }
        return true
      }
      if (result === 'failed') {
        toast.error('Неуспешно споделяне')
      }
      return false
    },
    [guidanceOnForBill, recordShared],
  )

  const interceptGuestShare = useCallback(
    async (billId: Id<'bills'>, joinUrl: string) => {
      if (!guidanceOnForBill(billId)) {
        return performShare(billId, joinUrl)
      }
      if (
        paymentStatus === 'configured' ||
        onboarding?.paymentCheckpointDismissed
      ) {
        return performShare(billId, joinUrl)
      }

      setPendingShare({ billId, joinUrl })
      setCheckpointOpen(true)
      return false
    },
    [
      guidanceOnForBill,
      onboarding?.paymentCheckpointDismissed,
      paymentStatus,
      performShare,
    ],
  )

  const dismissWelcome = useCallback(() => {
    deferWelcomeThisSession()
    setWelcomeForcedOpen(false)
  }, [])

  const stopGuidance = useCallback(async () => {
    const confirmed = await confirm(getStopGuidanceCopy())
    if (!confirmed) return
    await skipOnboarding({})
    setReplayActive(false)
    refreshBillSession()
  }, [confirm, refreshBillSession, skipOnboarding])

  const startReplay = useCallback(() => {
    clearAllDismissedHintsThisSession()
    startReplayThisSession()
    setReplayActive(true)
    toast.message(HOST_ONBOARDING_HOME.replayToast)
    refreshBillSession()
  }, [refreshBillSession])

  const chooseContentRoute = useCallback(
    (billId: Id<'bills'>, route: HostOnboardingContentRoute) => {
      saveContentRoute(billId, route)
      refreshBillSession()
    },
    [refreshBillSession],
  )

  const triggerFirstRunForDevTesting = useCallback(async () => {
    clearHostOnboardingSession()
    setReplayActive(false)
    setWelcomeStage('intro')
    try {
      await resetForDevTesting({})
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
      return
    }
    setWelcomeForcedOpen(true)
    refreshBillSession()
    if (onboarding && onboarding.billCount > 0) {
      toast.message(
        'Onboarding е нулиран. Можете да започнете сметка с напътствия без да изтривате съществуващите.',
      )
    } else {
      toast.message('First-run onboarding е готов за тест.')
    }
  }, [onboarding, refreshBillSession, resetForDevTesting])

  const value = useMemo<HostOnboardingContextValue>(
    () => ({
      showWelcome,
      dismissWelcome,
      resumeGuidedBillId:
        onboarding?.lifecycle === 'active'
          ? onboarding.guidedBillId
          : undefined,
      needsAnotherGuidedBill:
        onboarding?.lifecycle === 'active' &&
        onboarding.guidedBillId === undefined,
      guidanceOnForBill,
      makeGuidanceSlot: (input) => (anchor) => {
        if (!guidanceOnForBill(input.billId) && !replayActive) return null

        if (
          onboarding?.lifecycle === 'completed' &&
          guidanceOnForBill(input.billId) &&
          !isHandoffDismissedThisSession(input.billId)
        ) {
          if (anchor !== 'share' || input.step !== 4) return null
          return (
            <HandoffCard
              onDismiss={() => {
                dismissHandoffThisSession(input.billId)
                refreshBillSession()
              }}
            />
          )
        }

        if (!guidanceOnForBill(input.billId) && replayActive) {
          // Replay without a guided bill shows nothing bill-specific.
          return null
        }

        const { steps, dismissedHintIds } = buildGuidance(input)
        const stepGuidance = guidanceForEditorStep(
          steps,
          input.step,
          dismissedHintIds,
        )
        if (!stepGuidance || stepGuidance.anchor !== anchor) return null
        return (
          <GuidanceCardView
            step={stepGuidance}
            onDismissHint={() => {
              dismissHintThisSession(input.billId, stepGuidance.id)
              refreshBillSession()
            }}
            onStopGuidance={() => void stopGuidance()}
          />
        )
      },
      getStepBarSignal: (input) => {
        if (!guidanceOnForBill(input.billId)) return null
        const { steps, dismissedHintIds } = buildGuidance(input)
        const signal = stepBarGuidanceLabel({
          steps,
          currentStep: input.step,
          dismissedHintIds,
          stepLabels: BILL_STEP_LABELS,
        })
        if (!signal) return null
        if (signal.kind === 'on') return { kind: 'on' }
        return {
          kind: 'pointer',
          step: signal.step,
          label: signal.label,
          actionLabel: HOST_ONBOARDING_STEP_BAR.goToStep(signal.step),
        }
      },
      interceptGuestShare,
      stopGuidance,
      startReplay,
      chooseContentRoute,
      getContentRoute: (billId) => readContentRoute(billId),
      refreshBillSession,
      triggerFirstRunForDevTesting,
    }),
    [
      showWelcome,
      dismissWelcome,
      onboarding,
      guidanceOnForBill,
      replayActive,
      buildGuidance,
      interceptGuestShare,
      stopGuidance,
      startReplay,
      chooseContentRoute,
      refreshBillSession,
      triggerFirstRunForDevTesting,
    ],
  )

  async function handleCreateFirstBill(name: string) {
    return await createFirstBill({ hostDisplayName: name })
  }

  async function handleStartGuidedWithExistingBills() {
    const billId = await startGuidedBillWithExistingBills({})
    setWelcomeForcedOpen(false)
    deferWelcomeThisSession()
    return billId
  }

  async function handleShareWithoutPayment() {
    if (!pendingShare) return
    await dismissCheckpoint({})
    setCheckpointOpen(false)
    await performShare(pendingShare.billId, pendingShare.joinUrl)
    setPendingShare(null)
  }

  async function handlePaymentSavedAndShare() {
    if (!pendingShare) return
    setCheckpointOpen(false)
    await performShare(pendingShare.billId, pendingShare.joinUrl)
    setPendingShare(null)
  }

  return (
    <HostOnboardingContext.Provider value={value}>
      {children}
      <WelcomeSheet
        open={showWelcome}
        onOpenChange={(open) => {
          if (!open) {
            dismissWelcome()
            setWelcomeForcedOpen(false)
          }
        }}
        stage={welcomeStage}
        onAdvanceStage={() => setWelcomeStage('name')}
        onDismiss={dismissWelcome}
        authName={viewer?.name}
        username={viewer?.username}
        billCount={onboarding?.billCount ?? 0}
        onConfirmName={handleCreateFirstBill}
        onStartGuidedWithExistingBills={handleStartGuidedWithExistingBills}
      />
      <PaymentCheckpointSheet
        open={checkpointOpen}
        onOpenChange={setCheckpointOpen}
        onShareWithoutPayment={() => void handleShareWithoutPayment()}
        onSavedAndShare={() => void handlePaymentSavedAndShare()}
      />
    </HostOnboardingContext.Provider>
  )
}

export function useHostOnboarding(): HostOnboardingContextValue {
  const context = useContext(HostOnboardingContext)
  if (!context) {
    throw new Error(
      'useHostOnboarding must be used within HostOnboardingProvider',
    )
  }
  return context
}

function GuidanceCardView({
  step,
  onDismissHint,
  onStopGuidance,
}: {
  step: GuidanceStep
  onDismissHint: () => void
  onStopGuidance: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-l-4 border-primary/40 border-l-primary bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">{step.title}</p>
          {step.body ? (
            <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
          aria-label={HOST_ONBOARDING_STEP_BAR.dismissHint}
          onClick={onDismissHint}
        >
          ×
        </button>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="xs"
          className="text-muted-foreground"
          onClick={onStopGuidance}
        >
          {HOST_ONBOARDING_HOME.stopGuidance}
        </Button>
      </div>
    </div>
  )
}

function HandoffCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-l-4 border-success/40 border-l-success bg-success/5 p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{HOST_ONBOARDING_HANDOFF.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {HOST_ONBOARDING_HANDOFF.body}
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted"
        aria-label={HOST_ONBOARDING_STEP_BAR.dismissHint}
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  )
}
