import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { BillStep } from '#/components/bills/bill-steps-bar.tsx'
import { BILL_STEP_LABELS } from '#/components/bills/bill-steps-bar.tsx'
import { useHostOnboarding } from '#/components/host-onboarding/host-onboarding-provider.tsx'
import type { BillGuidanceInput } from '#/components/host-onboarding/host-onboarding-provider.tsx'
import { useReceiptScan } from '#/hooks/use-receipt-scan.ts'
import { useGuidanceFocus } from '#/lib/guidance-focus/use-guidance-focus.ts'
import type { BillEditorRelations } from '#/lib/bill-editing-controller.ts'
import {
  buildBillEditorDerivedState,
  buildBillEditorGuidanceInput,
  createInitialBillEditorMetadata,
  isReceiptUploadedForEditor,
  isRestaurantFromOcr,
  resolveOcrRestaurantApply,
  shouldResetBillEditorMetadata,
  shouldShowContentRouteChoice,
} from '#/lib/bill-editing-controller.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import {
  parseTipInputToCents,
  validateBillMetadataField,
} from '#/lib/bill-metadata-schema.ts'
import type { BillMetadataPatchInput } from '#/lib/bill-metadata-schema.ts'
import { readDismissedHintIds } from '#/lib/host-onboarding-session.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import {
  computeGuidanceState,
  GUIDANCE_FOCUS_TIMING,
} from '../../shared/guidance-controller.ts'
import { formatEurInputValue } from '../../shared/tip-calculations.ts'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

type BillData = NonNullable<FunctionReturnType<typeof api.bills.get>>

function mapBillRelations(data: BillData): BillEditorRelations {
  return {
    participants: data.participants.map((participant) => ({
      id: participant._id,
      name: participant.name,
      sortOrder: participant.sortOrder,
    })),
    items: data.items.map((item) => ({
      id: item._id,
      name: item.name,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
    })),
    assignments: data.assignments.map((assignment) => ({
      itemId: assignment.itemId,
      participantId: assignment.participantId,
      unitIndex: assignment.unitIndex,
    })),
    payments: data.payments.map((payment) => ({
      participantId: payment.participantId,
      amountCents: payment.amountCents,
    })),
  }
}

export interface UseBillEditorControllerOptions {
  billId: Id<'bills'>
  data: BillData
  step: BillStep
  goToStep: (next: BillStep, options?: { resetScroll?: boolean }) => void
}

export function useBillEditorController({
  billId,
  data,
  step,
  goToStep,
}: UseBillEditorControllerOptions) {
  const { bill, participants, items, assignments } = data
  const updateBill = useMutation(api.bills.update)
  const recordPreparedIfNeeded = useMutation(
    api.hostOnboarding.recordPreparedIfNeeded,
  )
  const {
    guidanceHintsEnabledForBill,
    makeGuidanceSlot,
    getStepBarSignal,
    interceptGuestShare,
    chooseContentRoute,
    getContentRoute,
    refreshBillSession,
    billSessionVersion,
    onboardingSharedAt,
  } = useHostOnboarding()

  const relations = useMemo(() => mapBillRelations(data), [data])
  const queueStepFocusRef = useRef<(stepId: string) => void>(() => {})
  const [receiptUploadedForGuidance, setReceiptUploadedForGuidance] = useState(
    () => Boolean(bill.receiptStorageId),
  )

  const receiptScan = useReceiptScan({
    billId,
    items,
    assignments,
    onReceiptUploaded: () => {
      setReceiptUploadedForGuidance(true)
      queueStepFocusRef.current('scan-run-ocr')
    },
  })

  const [metadata, setMetadata] = useState(() =>
    createInitialBillEditorMetadata(bill, formatEurInputValue),
  )
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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (bill.receiptStorageId) {
      setReceiptUploadedForGuidance(true)
    }
  }, [bill.receiptStorageId])

  useEffect(() => {
    if (shouldResetBillEditorMetadata(initializedBillId.current, bill._id)) {
      initializedBillId.current = bill._id
      appliedRestaurantFromScanRef.current = null
      setMetadata(createInitialBillEditorMetadata(bill, formatEurInputValue))
    }
  }, [bill])

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
    if (!receiptScan.completedScan?.extractedRestaurantName?.trim()) return

    const apply = resolveOcrRestaurantApply({
      scanId: receiptScan.completedScan._id,
      extractedRestaurantName:
        receiptScan.completedScan.extractedRestaurantName,
      appliedScanId: appliedRestaurantFromScanRef.current,
      currentRestaurantName: bill.restaurantName,
    })
    if (!apply) return

    appliedRestaurantFromScanRef.current =
      apply.appliedScanId as Id<'receiptScans'>
    setMetadata((prev) => ({ ...prev, restaurantName: apply.restaurantName }))
    scheduleSave({ restaurantName: apply.restaurantName })
  }, [bill.restaurantName, receiptScan.completedScan])

  const labels = useMemo(
    () => buildParticipantLabels(participants),
    [participants],
  )

  const tipCentsForTotals = useMemo(() => {
    const parsed = parseTipInputToCents(metadata.tip)
    return parsed.ok ? parsed.cents : 0
  }, [metadata.tip])

  const derived = useMemo(
    () =>
      buildBillEditorDerivedState({
        relations,
        hostParticipantId: bill.hostParticipantId,
        tipCents: tipCentsForTotals,
        restaurantNameDraft: metadata.restaurantName,
      }),
    [
      relations,
      bill.hostParticipantId,
      tipCentsForTotals,
      metadata.restaurantName,
    ],
  )

  const onboardingActive = guidanceHintsEnabledForBill(billId)
  const contentRoute = getContentRoute(billId)
  const receiptUploaded = isReceiptUploadedForEditor({
    receiptStorageId: bill.receiptStorageId,
    receiptUploadedForGuidance,
  })
  const restaurantFromOcr = isRestaurantFromOcr({
    extractedRestaurantName: receiptScan.completedScan?.extractedRestaurantName,
    restaurantNameDraft: metadata.restaurantName,
  })
  const showContentRouteChoice = shouldShowContentRouteChoice({
    onboardingActive,
    contentRoute,
    itemCount: items.length,
  })

  const guidanceInput = useMemo(
    () =>
      buildBillEditorGuidanceInput({
        billId,
        step,
        restaurantName: metadata.restaurantName,
        restaurantFromOcr,
        hostParticipantName: derived.hostParticipantName,
        guestCount: derived.guestCount,
        relations,
        receiptUploaded,
        receiptScanning: receiptScan.isScanning,
        scanReviewOpen: receiptScan.reviewSheetOpen,
      }),
    [
      billId,
      step,
      metadata.restaurantName,
      restaurantFromOcr,
      derived.hostParticipantName,
      derived.guestCount,
      relations,
      receiptUploaded,
      receiptScan.isScanning,
      receiptScan.reviewSheetOpen,
    ],
  )

  const guidanceSlot = useMemo(
    () => makeGuidanceSlot(guidanceInput as BillGuidanceInput),
    [makeGuidanceSlot, guidanceInput],
  )

  const guidanceState = useMemo(
    () =>
      computeGuidanceState({
        bill: {
          restaurantName: metadata.restaurantName,
          restaurantFromOcr,
          hostParticipantName: derived.hostParticipantName,
          guestCount: derived.guestCount,
          items: guidanceInput.items,
          assignments: guidanceInput.assignments,
          contentRoute,
          receiptUploaded: guidanceInput.receiptUploaded,
          receiptScanning: guidanceInput.receiptScanning,
          scanReviewOpen: guidanceInput.scanReviewOpen,
          sharedAt: onboardingSharedAt,
        },
        dismissedHintIds: readDismissedHintIds(billId),
        editorStep: step,
        stepLabels: BILL_STEP_LABELS,
      }),
    [
      billId,
      billSessionVersion,
      metadata.restaurantName,
      restaurantFromOcr,
      derived.hostParticipantName,
      derived.guestCount,
      guidanceInput,
      contentRoute,
      step,
      onboardingSharedAt,
    ],
  )

  const prevReviewSheetOpenRef = useRef(receiptScan.reviewSheetOpen)
  const [reviewSheetSettling, setReviewSheetSettling] = useState(
    () => receiptScan.reviewSheetOpen,
  )

  useLayoutEffect(() => {
    if (receiptScan.reviewSheetOpen) {
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
  }, [receiptScan.reviewSheetOpen])

  const guidanceFocus = useGuidanceFocus({
    enabled: onboardingActive,
    activeStep: guidanceState.activeStep,
    currentEditorStep: step,
    editorStepGuidanceComplete: guidanceState.editorStepGuidanceComplete,
    blockAutoNavigation: addGuestFocused,
    canShowNextButtonPop: !receiptScan.reviewSheetOpen && !reviewSheetSettling,
  })
  queueStepFocusRef.current = guidanceFocus.queueStepFocus

  useEffect(() => {
    if (step !== 2) {
      setAddGuestFocused(false)
    }
  }, [step])

  const stepBarSignal = useMemo(
    () => getStepBarSignal(guidanceInput as BillGuidanceInput),
    [getStepBarSignal, guidanceInput],
  )

  useEffect(() => {
    if (!onboardingActive) return
    void recordPreparedIfNeeded({
      billId,
      restaurantName: metadata.restaurantName,
      guestCount: derived.guestCount,
      items: guidanceInput.items,
      assignments: guidanceInput.assignments,
    })
  }, [
    onboardingActive,
    billId,
    metadata.restaurantName,
    derived.guestCount,
    guidanceInput.items,
    guidanceInput.assignments,
    recordPreparedIfNeeded,
  ])

  useEffect(() => {
    refreshBillSession()
  }, [
    step,
    items.length,
    derived.guestCount,
    metadata.restaurantName,
    receiptScan.isScanning,
    receiptScan.reviewSheetOpen,
    refreshBillSession,
  ])

  function handleTipValidCents(cents: number) {
    scheduleSave({ tipCents: cents })
  }

  return {
    bill,
    participants,
    items,
    assignments,
    labels,
    metadata,
    fieldErrors,
    breakdownOpen,
    setBreakdownOpen,
    addGuestFocused,
    setAddGuestFocused,
    derived,
    onboardingActive,
    contentRoute,
    receiptUploaded,
    showContentRouteChoice,
    guidanceInput,
    guidanceSlot,
    guidanceFocus,
    stepBarSignal,
    receiptScan,
    chooseContentRoute,
    interceptGuestShare,
    clearFieldError,
    scheduleValidatedSave,
    handleTipValidCents,
    setMetadata,
    setFieldErrors,
    goToStep,
  }
}
