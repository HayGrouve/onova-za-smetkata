import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import {
  CameraIcon,
  ImageIcon,
  Loader2Icon,
  ReceiptIcon,
  ScanLineIcon,
  ShoppingBagIcon,
  UsersIcon,
} from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BillAdvancedSettings } from '#/components/bills/bill-advanced-settings.tsx'
import { OcrActivityBar } from '#/components/bills/ocr-activity-bar.tsx'
import { TipField } from '#/components/bills/tip-field.tsx'
import { ItemList } from '#/components/bills/item-list.tsx'
import { BillInviteCard } from '#/components/bills/bill-invite-card.tsx'
import { ParticipantList } from '#/components/bills/participant-list.tsx'
import { ReceiptScanReviewSheet } from '#/components/bills/receipt-scan-review-sheet.tsx'
import { BillStepsBar } from '#/components/bills/bill-steps-bar.tsx'
import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import { BillSummaryContent } from '#/components/bills/bill-summary-content.tsx'
import { StepNavBar } from '#/components/bills/step-nav-bar.tsx'
import { TotalsBreakdownSheet } from '#/components/bills/totals-breakdown-sheet.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { calculateBillTotals } from '#/lib/bill-calculations.ts'
import { toBillCalculationSnapshot } from '#/lib/bill-calculation-snapshot.ts'
import { getBillStepCompletion } from '#/lib/bill-step-completion.ts'
import { countItemsWithEmptyUnits } from '../../../../shared/unit-coverage.ts'
import {
  calculateItemsSubtotalCents,
  formatEurInputValue,
} from '../../../../shared/tip-calculations.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import {
  parseTipInputToCents,
  validateBillMetadataField,
} from '#/lib/bill-metadata-schema.ts'
import type { BillMetadataPatchInput } from '#/lib/bill-metadata-schema.ts'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { useReceiptScan } from '#/hooks/use-receipt-scan.ts'
import { BillHeaderTitleSync } from '#/components/layout/bill-header-title.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import { ContentRouteChoice } from '#/components/host-onboarding/content-route-choice.tsx'
import { useHostOnboarding } from '#/components/host-onboarding/host-onboarding-provider.tsx'
import { GuidanceTarget } from '#/lib/guidance-focus/guidance-target.tsx'
import { useGuidanceFocus } from '#/lib/guidance-focus/use-guidance-focus.ts'
import { GUIDANCE_FOCUS_TIMING } from '../../../../shared/plan-guidance-focus.ts'
import { readDismissedHintIds } from '#/lib/host-onboarding-session.ts'
import { deriveHostOnboardingGuidance } from '../../../../shared/host-onboarding.ts'
import { HOST_ONBOARDING_STEP_BAR } from '../../../../shared/host-onboarding-messages.ts'
import { isHostParticipant } from '../../../../shared/host-bill-participant.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

type BillData = NonNullable<FunctionReturnType<typeof api.bills.get>>

function clampStep(value: unknown): BillStep {
  const n = Number(value)
  if (n === 2 || n === 3 || n === 4) return n
  return 1
}

export const Route = createFileRoute('/bills/$billId/')({
  validateSearch: (search: Record<string, unknown>) => ({
    step: clampStep(search.step),
  }),
  head: () => buildNoIndexHead('Сметка'),
  component: BillEditor,
})

function toDateInputValue(ms: number): string {
  const d = new Date(ms)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function fromDateInputValue(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

function BillEditor() {
  const params = Route.useParams()
  const billId = params.billId as Id<'bills'>
  const { isAuthenticated, isLoading: authLoading } = useRequireHostAuth(
    `/bills/${billId}`,
  )
  const data = useQuery(api.bills.get, isAuthenticated ? { billId } : 'skip')

  if (authLoading || !isAuthenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  if (data === undefined) {
    return <BillEditorSkeleton />
  }

  return <BillEditorContent billId={billId} data={data} />
}

function BillEditorSkeleton() {
  return (
    <div className="page-container flex flex-col gap-4">
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}

function BillEditorContent({
  billId,
  data,
}: {
  billId: Id<'bills'>
  data: BillData
}) {
  const { bill, participants, items, assignments, payments } = data
  const updateBill = useMutation(api.bills.update)
  const recordPreparedIfNeeded = useMutation(
    api.hostOnboarding.recordPreparedIfNeeded,
  )
  const {
    guidanceOnForBill,
    makeGuidanceSlot,
    getStepBarSignal,
    interceptGuestShare,
    chooseContentRoute,
    getContentRoute,
    refreshBillSession,
  } = useHostOnboarding()

  const { step } = Route.useSearch()
  const navigate = Route.useNavigate()

  function goToStep(next: BillStep, options?: { resetScroll?: boolean }) {
    void navigate({
      search: { step: next },
      resetScroll: options?.resetScroll ?? true,
    })
  }

  const receiptUrl = useQuery(api.files.getReceiptUrl, { billId })

  const onboardingActive = guidanceOnForBill(billId)
  const contentRoute = getContentRoute(billId)
  const queueStepFocusRef = useRef<(stepId: string) => void>(() => {})
  const [receiptUploadedForGuidance, setReceiptUploadedForGuidance] = useState(
    () => Boolean(bill.receiptStorageId),
  )

  const {
    galleryInputRef,
    cameraInputRef,
    isUploading,
    isScanning,
    isOcrBusy,
    completedScan,
    handleReceiptChange,
    handleScanButtonClick,
    preScanDialogOpen,
    setPreScanDialogOpen,
    replaceConfirmOpen,
    setReplaceConfirmOpen,
    handlePreScanChoice,
    handleReplaceConfirm,
    reviewSheetOpen,
    setReviewSheetOpen,
    activeScanId,
    importMode,
  } = useReceiptScan({
    billId,
    items,
    assignments,
    onReceiptUploaded: () => {
      setReceiptUploadedForGuidance(true)
      queueStepFocusRef.current('scan-run-ocr')
    },
  })

  const [restaurantName, setRestaurantName] = useState(bill.restaurantName)
  const [date, setDate] = useState(() => toDateInputValue(bill.date))
  const [note, setNote] = useState(bill.note ?? '')
  const [tip, setTip] = useState(() => formatEurInputValue(bill.tipCents ?? 0))
  const [fieldErrors, setFieldErrors] = useState<{
    restaurantName?: string
    note?: string
    tip?: string
    date?: string
  }>({})
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [addGuestFocused, setAddGuestFocused] = useState(false)
  const initializedBillId = useRef(bill._id)
  const appliedRestaurantFromScanRef = useRef<Id<'receiptScans'> | null>(null)

  useEffect(() => {
    if (bill.receiptStorageId) {
      setReceiptUploadedForGuidance(true)
    }
  }, [bill.receiptStorageId])

  useEffect(() => {
    if (initializedBillId.current !== bill._id) {
      initializedBillId.current = bill._id
      appliedRestaurantFromScanRef.current = null
      setRestaurantName(bill.restaurantName)
      setDate(toDateInputValue(bill.date))
      setNote(bill.note ?? '')
      setTip(formatEurInputValue(bill.tipCents ?? 0))
    }
  }, [bill])

  useEffect(() => {
    if (bill.status === 'final' && step !== 4) {
      void navigate({ search: { step: 4 }, resetScroll: true })
    }
  }, [bill.status, step, navigate])

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleSave(patch: BillMetadataPatchInput) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void updateBill({ billId, ...patch }).catch((error) => {
        toast.error(getConvexErrorMessage(error))
      })
    }, 500)
  }

  function clearFieldError(field: keyof typeof fieldErrors) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  function scheduleValidatedSave(
    field: 'restaurantName' | 'note' | 'tip' | 'date',
    rawValue: string,
    options?: { dateMs?: number },
  ) {
    const validated = validateBillMetadataField(field, rawValue, options)
    if (!validated.ok) {
      setFieldErrors((prev) => ({ ...prev, [field]: validated.message }))
      return
    }
    clearFieldError(field)
    scheduleSave(validated.patch)
  }
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!completedScan?.extractedRestaurantName?.trim()) return
    if (appliedRestaurantFromScanRef.current === completedScan._id) return
    if (bill.restaurantName.trim()) return

    const extracted = completedScan.extractedRestaurantName.trim()
    appliedRestaurantFromScanRef.current = completedScan._id
    setRestaurantName(extracted)
    scheduleSave({ restaurantName: extracted })
  }, [bill.restaurantName, completedScan])

  const labels = useMemo(
    () => buildParticipantLabels(participants),
    [participants],
  )

  const itemsSubtotalCents = useMemo(
    () =>
      calculateItemsSubtotalCents(
        items.map((i) => ({
          id: i._id,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
        })),
      ),
    [items],
  )

  function handleTipValidCents(cents: number) {
    scheduleSave({ tipCents: cents })
  }

  const tipCentsForTotals = useMemo(() => {
    const parsed = parseTipInputToCents(tip)
    return parsed.ok ? parsed.cents : 0
  }, [tip])

  const billSnapshot = useMemo(() => {
    return toBillCalculationSnapshot(
      { participants, items, assignments, payments },
      {
        tipCents: tipCentsForTotals,
        hostParticipantId: bill.hostParticipantId,
      },
    )
  }, [
    participants,
    items,
    assignments,
    payments,
    tipCentsForTotals,
    bill.hostParticipantId,
  ])

  const totals = useMemo(
    () => calculateBillTotals(billSnapshot.calculationInput),
    [billSnapshot],
  )

  const unassignedItemsCount = useMemo(() => {
    return countItemsWithEmptyUnits(
      billSnapshot.calculationInput.items,
      billSnapshot.calculationInput.assignments,
    )
  }, [billSnapshot])

  const stepCompletion = useMemo(
    () =>
      getBillStepCompletion({
        restaurantName,
        ...billSnapshot.calculationInput,
      }),
    [restaurantName, billSnapshot],
  )

  const guestCount = useMemo(
    () =>
      participants.filter(
        (participant) =>
          !isHostParticipant(participant._id, bill.hostParticipantId),
      ).length,
    [participants, bill.hostParticipantId],
  )

  const hostParticipantName = useMemo(() => {
    const host = participants.find((participant) =>
      isHostParticipant(participant._id, bill.hostParticipantId),
    )
    return host?.name ?? 'домакин'
  }, [participants, bill.hostParticipantId])

  const restaurantFromOcr = Boolean(
    completedScan?.extractedRestaurantName?.trim() &&
    restaurantName.trim() !== '',
  )

  const receiptUploaded =
    Boolean(bill.receiptStorageId) || receiptUploadedForGuidance

  const showContentRouteChoice =
    onboardingActive && contentRoute === undefined && items.length === 0

  const guidanceInput = useMemo(
    () => ({
      billId,
      step,
      restaurantName,
      restaurantFromOcr,
      hostParticipantName,
      guestCount,
      items: items.map((item) => ({
        id: item._id,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
      })),
      assignments: assignments.map((assignment) => ({
        itemId: assignment.itemId,
        participantId: assignment.participantId,
        unitIndex: assignment.unitIndex,
      })),
      receiptUploaded,
      receiptScanning: isScanning,
      scanReviewOpen: reviewSheetOpen,
    }),
    [
      billId,
      step,
      restaurantName,
      restaurantFromOcr,
      hostParticipantName,
      guestCount,
      items,
      assignments,
      receiptUploaded,
      isScanning,
      reviewSheetOpen,
    ],
  )

  const guidanceSlot = useMemo(
    () => makeGuidanceSlot(guidanceInput),
    [makeGuidanceSlot, guidanceInput],
  )

  const guidanceStepsBundle = useMemo(() => {
    const dismissedHintIds = readDismissedHintIds(billId)
    const steps = deriveHostOnboardingGuidance({
      bill: {
        restaurantName,
        restaurantFromOcr,
        hostParticipantName,
        guestCount,
        items: guidanceInput.items,
        assignments: guidanceInput.assignments,
        contentRoute,
        receiptUploaded: guidanceInput.receiptUploaded,
        receiptScanning: guidanceInput.receiptScanning,
        scanReviewOpen: guidanceInput.scanReviewOpen,
      },
      dismissedHintIds,
    })
    return { steps, dismissedHintIds }
  }, [
    billId,
    restaurantName,
    restaurantFromOcr,
    hostParticipantName,
    guestCount,
    guidanceInput,
    contentRoute,
  ])

  const prevReviewSheetOpenRef = useRef(reviewSheetOpen)
  const [reviewSheetSettling, setReviewSheetSettling] = useState(
    () => reviewSheetOpen,
  )

  useLayoutEffect(() => {
    if (reviewSheetOpen) {
      prevReviewSheetOpenRef.current = true
      setReviewSheetSettling(true)
      return
    }

    if (prevReviewSheetOpenRef.current) {
      prevReviewSheetOpenRef.current = false
      setReviewSheetSettling(true)
      const timer = window.setTimeout(
        () => setReviewSheetSettling(false),
        GUIDANCE_FOCUS_TIMING.SHEET_CLOSE_SETTLE_MS,
      )
      return () => window.clearTimeout(timer)
    }

    setReviewSheetSettling(false)
  }, [reviewSheetOpen])

  const guidanceFocus = useGuidanceFocus({
    enabled: onboardingActive,
    steps: guidanceStepsBundle.steps,
    dismissedHintIds: guidanceStepsBundle.dismissedHintIds,
    currentEditorStep: step,
    blockAutoNavigation: addGuestFocused,
    canShowNextButtonPop: !reviewSheetOpen && !reviewSheetSettling,
  })
  queueStepFocusRef.current = guidanceFocus.queueStepFocus

  useEffect(() => {
    if (step !== 2) {
      setAddGuestFocused(false)
    }
  }, [step])

  const stepBarSignal = useMemo(
    () => getStepBarSignal(guidanceInput),
    [getStepBarSignal, guidanceInput],
  )

  useEffect(() => {
    if (!onboardingActive) return
    void recordPreparedIfNeeded({
      billId,
      restaurantName,
      guestCount,
      items: guidanceInput.items,
      assignments: guidanceInput.assignments,
    })
  }, [
    onboardingActive,
    billId,
    restaurantName,
    guestCount,
    guidanceInput.items,
    guidanceInput.assignments,
    recordPreparedIfNeeded,
  ])

  useEffect(() => {
    refreshBillSession()
  }, [
    step,
    items.length,
    guestCount,
    restaurantName,
    isScanning,
    reviewSheetOpen,
    refreshBillSession,
  ])

  const stepBarGuidanceNode =
    stepBarSignal?.kind === 'on' ? (
      <p className="text-xs text-primary">
        {HOST_ONBOARDING_STEP_BAR.guidanceOn}
      </p>
    ) : stepBarSignal?.kind === 'pointer' ? (
      <div
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center justify-between gap-2 text-xs text-primary"
      >
        <span>
          {HOST_ONBOARDING_STEP_BAR.nextStepPrefix} {stepBarSignal.label}
        </span>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="h-7 shrink-0 text-primary"
          onClick={() => goToStep(stepBarSignal.step)}
        >
          {stepBarSignal.actionLabel}
        </Button>
      </div>
    ) : null

  return (
    <>
      <OcrActivityBar isUploading={isUploading} isScanning={isScanning} />
      <BillHeaderTitleSync title={bill.restaurantName} />
      <BillStepsBar
        step={step}
        completed={stepCompletion}
        onStepSelect={goToStep}
        guidanceSignal={stepBarGuidanceNode}
      />
      <div
        key={step}
        className={cn(
          'page-container animate-in fade-in slide-in-from-bottom-2 duration-[250ms]',
          isOcrBusy && 'pt-1',
        )}
      >
        <div className="flex flex-col gap-4">
          {step === 1 && (
            <>
              {showContentRouteChoice ? (
                <GuidanceTarget
                  stepId="content-route"
                  register={guidanceFocus.registerTarget}
                  shouldPop={guidanceFocus.poppingStepId === 'content-route'}
                  reducedHighlight={
                    guidanceFocus.reducedHighlightStepId === 'content-route'
                  }
                  onPopAnimationEnd={guidanceFocus.onPopAnimationEnd}
                >
                  <ContentRouteChoice
                    onChoose={(route) => {
                      chooseContentRoute(billId, route)
                    }}
                  />
                </GuidanceTarget>
              ) : null}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptIcon className={ICON.section} aria-hidden />
                    Касова бележка
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {!receiptUploaded ? (
                    <GuidanceTarget
                      stepId="scan-upload"
                      register={guidanceFocus.registerTarget}
                      shouldPop={guidanceFocus.poppingStepId === 'scan-upload'}
                      reducedHighlight={
                        guidanceFocus.reducedHighlightStepId === 'scan-upload'
                      }
                      onPopAnimationEnd={guidanceFocus.onPopAnimationEnd}
                    >
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        disabled={isOcrBusy}
                        className={cn(
                          'tap-feedback flex w-full flex-col items-center gap-3 rounded-lg border border-dashed p-4 text-left',
                          'cursor-pointer transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        <p className="self-start text-sm text-muted-foreground">
                          Качете снимка на бележката, за да разпознаете
                          артикулите автоматично.
                        </p>
                      </button>
                    </GuidanceTarget>
                  ) : (
                    <div
                      className={cn(
                        'overflow-hidden rounded-lg border border-dashed',
                        isScanning && 'receipt-scan-image-active',
                      )}
                    >
                      {receiptUrl ? (
                        <img
                          src={receiptUrl}
                          alt="Касова бележка"
                          className="block w-full object-contain"
                        />
                      ) : (
                        <p className="p-4 text-sm text-muted-foreground">
                          Зареждане на снимката...
                        </p>
                      )}
                    </div>
                  )}
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="hidden"
                    onChange={handleReceiptChange}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    capture="environment"
                    className="hidden"
                    onChange={handleReceiptChange}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isOcrBusy}
                      className="tap-feedback flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground disabled:opacity-50"
                    >
                      <ImageIcon className="size-4" aria-hidden />
                      {isUploading ? 'Качване...' : 'От галерията'}
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={isOcrBusy}
                      className="tap-feedback flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground disabled:opacity-50"
                    >
                      <CameraIcon className="size-4" aria-hidden />
                      {isUploading ? 'Качване...' : 'Снимай'}
                    </button>
                  </div>
                  {receiptUploaded ? (
                    <GuidanceTarget
                      stepId="scan-run-ocr"
                      register={guidanceFocus.registerTarget}
                      shouldPop={guidanceFocus.poppingStepId === 'scan-run-ocr'}
                      reducedHighlight={
                        guidanceFocus.reducedHighlightStepId === 'scan-run-ocr'
                      }
                      onPopAnimationEnd={guidanceFocus.onPopAnimationEnd}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full"
                        disabled={isOcrBusy}
                        aria-busy={isOcrBusy}
                        onClick={handleScanButtonClick}
                      >
                        {isScanning ? (
                          <Loader2Icon
                            className={cn(
                              ICON.button,
                              'animate-spin motion-reduce:animate-none',
                            )}
                            aria-hidden
                          />
                        ) : (
                          <ScanLineIcon className={ICON.button} aria-hidden />
                        )}
                        {isScanning ? 'Разпознаване…' : 'Разпознай артикули'}
                      </Button>
                    </GuidanceTarget>
                  ) : null}
                </CardContent>
              </Card>

              {!showContentRouteChoice ? guidanceSlot('content') : null}

              {guidanceSlot('bill-details')}
              <GuidanceTarget
                stepId="restaurant"
                register={guidanceFocus.registerTarget}
                shouldPop={guidanceFocus.poppingStepId === 'restaurant'}
                reducedHighlight={
                  guidanceFocus.reducedHighlightStepId === 'restaurant'
                }
                onPopAnimationEnd={guidanceFocus.onPopAnimationEnd}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ReceiptIcon className={ICON.section} aria-hidden />
                      Данни за сметката
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <TipField
                      key={bill._id}
                      itemsSubtotalCents={itemsSubtotalCents}
                      value={tip}
                      onValueChange={(value) => {
                        setTip(value)
                        if (fieldErrors.tip) clearFieldError('tip')
                        const validated = validateBillMetadataField(
                          'tip',
                          value,
                        )
                        if (!validated.ok) {
                          setFieldErrors((prev) => ({
                            ...prev,
                            tip: validated.message,
                          }))
                          return
                        }
                        clearFieldError('tip')
                      }}
                      onValidCents={handleTipValidCents}
                      error={fieldErrors.tip}
                      onClearError={() => clearFieldError('tip')}
                    />
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="restaurantName">Ресторант</Label>
                      <Input
                        id="restaurantName"
                        value={restaurantName}
                        onChange={(e) => {
                          const value = e.target.value
                          setRestaurantName(value)
                          if (fieldErrors.restaurantName)
                            clearFieldError('restaurantName')
                          scheduleValidatedSave('restaurantName', value)
                        }}
                        placeholder="Напр. Механа Крайречна"
                        className="h-11"
                        aria-invalid={Boolean(fieldErrors.restaurantName)}
                      />
                      {fieldErrors.restaurantName ? (
                        <p className="text-xs text-destructive">
                          {fieldErrors.restaurantName}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Попълва се автоматично при разпознаване на бележката,
                        ако името е видимо на снимката.
                      </p>
                    </div>
                    <BillAdvancedSettings
                      note={note}
                      date={date}
                      noteError={fieldErrors.note}
                      dateError={fieldErrors.date}
                      onNoteChange={(value) => {
                        setNote(value)
                        if (fieldErrors.note) clearFieldError('note')
                        scheduleValidatedSave('note', value)
                      }}
                      onDateChange={(value) => {
                        setDate(value)
                        if (fieldErrors.date) clearFieldError('date')
                        scheduleValidatedSave('date', value, {
                          dateMs: fromDateInputValue(value),
                        })
                      }}
                    />
                  </CardContent>
                </Card>
              </GuidanceTarget>
            </>
          )}

          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className={ICON.section} aria-hidden />
                  Участници
                </CardTitle>
              </CardHeader>
              <CardContent>
                {guidanceSlot('participants')}
                <ParticipantList
                  billId={billId}
                  participants={participants}
                  labels={labels}
                  hostParticipantId={bill.hostParticipantId}
                  readOnly={bill.status === 'final'}
                  suggestedGroupName={bill.restaurantName}
                  participantsGuidance={
                    onboardingActive
                      ? {
                          register: guidanceFocus.registerTarget,
                          shouldPop:
                            guidanceFocus.poppingStepId === 'participants',
                          reducedHighlight:
                            guidanceFocus.reducedHighlightStepId ===
                            'participants',
                          onPopAnimationEnd: guidanceFocus.onPopAnimationEnd,
                          onAddGuestFocusChange: setAddGuestFocused,
                        }
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <>
              {participants.length === 0 && (
                <Card>
                  <CardContent className="flex flex-col items-start gap-2">
                    <p className="text-sm text-muted-foreground">
                      Няма участници — добавете ги, за да разпределите
                      артикулите.
                    </p>
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => goToStep(2)}
                    >
                      Към стъпка 2 · Участници
                    </Button>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingBagIcon className={ICON.section} aria-hidden />
                      Артикули
                    </CardTitle>
                    {bill.hostParticipantId ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 shrink-0"
                        onClick={() =>
                          void navigate({
                            to: '/bills/$billId/claim',
                            params: { billId },
                            search: { mode: 'host' },
                          })
                        }
                      >
                        Моите артикули
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {guidanceSlot('allocation')}
                  {guidanceSlot('share')}
                  <BillInviteCard
                    billId={billId}
                    shareToken={bill.shareToken}
                    disabled={participants.length === 0}
                    readOnly={bill.status === 'final'}
                    onShareLink={
                      onboardingActive
                        ? (joinUrl) => interceptGuestShare(billId, joinUrl)
                        : undefined
                    }
                    shareGuidance={
                      onboardingActive
                        ? {
                            register: guidanceFocus.registerTarget,
                            shouldPop: guidanceFocus.poppingStepId === 'share',
                            reducedHighlight:
                              guidanceFocus.reducedHighlightStepId === 'share',
                            onPopAnimationEnd: guidanceFocus.onPopAnimationEnd,
                          }
                        : undefined
                    }
                    allocationGuidance={
                      onboardingActive
                        ? {
                            register: guidanceFocus.registerTarget,
                            shouldPop:
                              guidanceFocus.poppingStepId === 'allocation',
                            reducedHighlight:
                              guidanceFocus.reducedHighlightStepId ===
                              'allocation',
                            onPopAnimationEnd: guidanceFocus.onPopAnimationEnd,
                          }
                        : undefined
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Добавете данък като отделен артикул. Бакшишът се въвежда на
                    стъпка 1.
                  </p>
                  <ItemList
                    billId={billId}
                    items={items}
                    participants={participants}
                    assignments={assignments}
                    labels={labels}
                    readOnly={bill.status === 'final'}
                  />
                </CardContent>
              </Card>
            </>
          )}

          {step === 4 && (
            <>
              {guidanceSlot('share')}
              <BillSummaryContent billId={billId} embedded />
            </>
          )}
        </div>
      </div>

      {!reviewSheetOpen && (
        <StepNavBar
          step={step}
          onStepChange={goToStep}
          totalCents={totals.billTotalCents}
          unassignedCount={unassignedItemsCount}
          onTotalClick={() => setBreakdownOpen(true)}
          nextButtonPopToken={guidanceFocus.nextButtonPopToken}
          onNextButtonPopEnd={guidanceFocus.onNextButtonPopEnd}
        />
      )}

      <TotalsBreakdownSheet
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        totals={totals}
        participants={participants}
        labels={labels}
      />

      <Dialog open={preScanDialogOpen} onOpenChange={setPreScanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вече има артикули в сметката</DialogTitle>
            <DialogDescription>
              Искате ли да добавите разпознатите артикули към съществуващите,
              или да ги замените?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreScanDialogOpen(false)}
            >
              Отказ
            </Button>
            <Button
              variant="outline"
              onClick={() => handlePreScanChoice('replace')}
            >
              Замени
            </Button>
            <Button onClick={() => handlePreScanChoice('add')}>Добави</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={replaceConfirmOpen} onOpenChange={setReplaceConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ще изтриете съществуващите артикули</DialogTitle>
            <DialogDescription>
              Артикулите имат разпределения между участници. Замяната ще изтрие
              съществуващите артикули и разпределенията им. Продължавате ли?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReplaceConfirmOpen(false)}
            >
              Отказ
            </Button>
            <Button variant="destructive" onClick={handleReplaceConfirm}>
              Замени
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeScanId && (
        <ReceiptScanReviewSheet
          open={reviewSheetOpen}
          onOpenChange={setReviewSheetOpen}
          billId={billId}
          importMode={importMode}
          scanId={activeScanId}
          scanReviewGuidance={
            onboardingActive
              ? {
                  register: guidanceFocus.registerTarget,
                  shouldPop: guidanceFocus.poppingStepId === 'scan-review',
                  reducedHighlight:
                    guidanceFocus.reducedHighlightStepId === 'scan-review',
                  onPopAnimationEnd: guidanceFocus.onPopAnimationEnd,
                }
              : undefined
          }
        />
      )}
    </>
  )
}
