import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { useEffect } from 'react'
import { withReducedMotion } from '#/components/motion-root.tsx'
import { BillAdvancedSettings } from '#/components/bills/bill-advanced-settings.tsx'
import { OcrActivityBar } from '#/components/bills/ocr-activity-bar.tsx'
import { ParticipantList } from '#/components/bills/participant-list.tsx'
import { ReceiptScanReviewSheet } from '#/components/bills/receipt-scan-review-sheet.tsx'
import { TipField } from '#/components/bills/tip-field.tsx'
import type { BillStep } from '#/lib/bill-steps.ts'
import { AssembleLines } from '#/components/host/assemble-lines.tsx'
import { HostBillView } from '#/components/host/host-bill-view.tsx'
import { ContentRouteChoice } from '#/components/host-onboarding/content-route-choice.tsx'
import { StickyGuidanceBar } from '#/components/host-onboarding/sticky-guidance-bar.tsx'
import { BillHeaderTitleSync } from '#/components/layout/bill-header-title.tsx'
import { Rule } from '#/components/receipt/paper.tsx'
import { ReceiptLoading } from '#/components/receipt/receipt-states.tsx'
import { phaseForStep, stepForPhase } from '#/components/receipt/timeline.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { useBillEditorController } from '#/hooks/use-bill-editor-controller.ts'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { GuidanceTarget } from '#/lib/guidance-focus/guidance-target.tsx'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import {
  clampBillEditorStep,
  fromBillEditorDateInputValue,
  shouldRedirectFinalBillToSummary,
} from '../../../../shared/bill-editing-controller.ts'
import { validateBillMetadataField } from '../../../../shared/bill-metadata-schema.ts'
import { HOST_ONBOARDING_STEP_BAR } from '../../../../shared/host-onboarding-messages.ts'
import type { FunctionReturnType } from 'convex/server'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

type BillData = NonNullable<FunctionReturnType<typeof api.bills.get>>

export const Route = createFileRoute('/bills/$billId/')({
  validateSearch: (search: Record<string, unknown>) => ({
    step: clampBillEditorStep(search.step),
  }),
  head: () => buildNoIndexHead('Сметка'),
  component: withReducedMotion(BillEditor),
})

function BillEditor() {
  const params = Route.useParams()
  const billId = params.billId as Id<'bills'>
  const { isAuthenticated, isLoading: authLoading } = useRequireHostAuth(
    `/bills/${billId}`,
  )
  const data = useQuery(api.bills.get, isAuthenticated ? { billId } : 'skip')

  if (authLoading || !isAuthenticated) {
    return <ReceiptLoading lines={7} />
  }

  if (data === undefined) {
    return <BillEditorSkeleton />
  }

  return <BillEditorContent billId={billId} data={data} />
}

function BillEditorSkeleton() {
  return <ReceiptLoading lines={7} />
}

function BillEditorContent({
  billId,
  data,
}: {
  billId: Id<'bills'>
  data: BillData
}) {
  const { step } = Route.useSearch()
  const navigate = Route.useNavigate()

  function goToStep(next: BillStep, options?: { resetScroll?: boolean }) {
    void navigate({
      search: { step: next },
      resetScroll: options?.resetScroll ?? true,
    })
  }

  useEffect(() => {
    if (shouldRedirectFinalBillToSummary(data.bill.status, step)) {
      void navigate({ search: { step: 4 }, resetScroll: true })
    }
  }, [data.bill.status, step, navigate])

  const editor = useBillEditorController({ billId, data, step, goToStep })
  const {
    bill,
    participants,
    items,
    labels,
    metadata,
    fieldErrors,
    derived,
    onboardingActive,
    receiptUploaded,
    showContentRouteChoice,
    guidancePanel,
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
    setAddGuestFocused,
    refreshBillSession,
    billSessionVersion,
  } = editor

  const receiptUrl = useQuery(api.files.getReceiptUrl, { billId })

  // Step 2 is the people section of the same receipt: bring it into view.
  useEffect(() => {
    if (step !== 2) return
    const frame = window.requestAnimationFrame(() =>
      document
        .getElementById('bill-people')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    )
    return () => window.cancelAnimationFrame(frame)
  }, [step])

  const phase = phaseForStep(step)
  const guestCount = derived.guestCount
  const blockers: string[] = []
  if (!metadata.restaurantName.trim())
    blockers.push('Въведете име на заведението.')
  if (items.length === 0) blockers.push('Добавете поне един ред.')
  if (guestCount === 0) blockers.push('Добавете поне един човек на масата.')

  const stepBarGuidanceNode =
    stepBarSignal?.kind === 'on' ? (
      <p className="text-[11px] text-stamp-ink">
        {HOST_ONBOARDING_STEP_BAR.guidanceOn}
      </p>
    ) : stepBarSignal?.kind === 'pointer' ? (
      <div
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center justify-between gap-2 text-[11px]"
      >
        <span>
          {HOST_ONBOARDING_STEP_BAR.nextStepPrefix} {stepBarSignal.label}
        </span>
        <Button
          type="button"
          size="xs"
          variant="outline"
          className="shrink-0"
          onClick={() => goToStep(stepBarSignal.step)}
        >
          {stepBarSignal.actionLabel}
        </Button>
      </div>
    ) : null

  const guidance =
    guidancePanel || stepBarGuidanceNode ? (
      <div className="sticky top-14 z-30 mx-auto w-full max-w-[1180px] px-3 sm:px-6">
        <div className="space-y-1.5 rounded-b-[18px] bg-table-2 px-3 py-2">
          {stepBarGuidanceNode}
          <StickyGuidanceBar
            billId={billId}
            panel={guidancePanel}
            sessionVersion={billSessionVersion}
            onSessionChange={refreshBillSession}
          />
        </div>
      </div>
    ) : null

  const restaurantField = (
    <GuidanceTarget stepId="restaurant" focus={guidanceFocus}>
      <div>
        <label htmlFor="restaurantName" className="sr-only">
          Име на заведението
        </label>
        <input
          id="restaurantName"
          value={metadata.restaurantName}
          onChange={(event) => {
            const value = event.target.value
            setMetadata((prev) => ({ ...prev, restaurantName: value }))
            if (fieldErrors.restaurantName) clearFieldError('restaurantName')
            scheduleValidatedSave('restaurantName', value)
          }}
          placeholder="Заведение"
          className="paper-input font-display text-[22px] font-bold uppercase"
          aria-invalid={Boolean(fieldErrors.restaurantName)}
          aria-describedby="restaurantName-hint"
        />
        {fieldErrors.restaurantName ? (
          <p className="mt-1 text-[11px] font-semibold text-destructive">
            {fieldErrors.restaurantName}
          </p>
        ) : null}
        <p id="restaurantName-hint" className="mt-1 text-[11px] text-ink-muted">
          Гостите го виждат, когато отворят линка. Попълва се от снимката на
          бележката.
        </p>
      </div>
    </GuidanceTarget>
  )

  const assembleBody = (
    <>
      {showContentRouteChoice ? (
        <GuidanceTarget stepId="content-route" focus={guidanceFocus}>
          <div className="mb-3">
            <ContentRouteChoice
              onChoose={(route) => {
                chooseContentRoute(billId, route)
              }}
            />
          </div>
        </GuidanceTarget>
      ) : null}
      <AssembleLines
        billId={billId}
        items={items}
        receiptScan={receiptScan}
        receiptUploaded={receiptUploaded}
        receiptUrl={receiptUrl}
        itemsSubtotalCents={derived.itemsSubtotalCents}
        guidanceFocus={guidanceFocus}
      />
      <Rule />
      <section aria-label="Бакшиш и детайли" className="space-y-3">
        <TipField
          key={bill._id}
          itemsSubtotalCents={derived.itemsSubtotalCents}
          storedTipCents={bill.tipCents}
          value={metadata.tip}
          onValueChange={(value) => {
            setMetadata((prev) => ({ ...prev, tip: value }))
            if (fieldErrors.tip) clearFieldError('tip')
            const validated = validateBillMetadataField('tip', value)
            if (!validated.ok) {
              setFieldErrors((prev) => ({ ...prev, tip: validated.message }))
              return
            }
            clearFieldError('tip')
          }}
          onValidCents={handleTipValidCents}
          error={fieldErrors.tip}
          onClearError={() => clearFieldError('tip')}
        />
        <BillAdvancedSettings
          note={metadata.note}
          date={metadata.date}
          noteError={fieldErrors.note}
          dateError={fieldErrors.date}
          onNoteChange={(value) => {
            setMetadata((prev) => ({ ...prev, note: value }))
            if (fieldErrors.note) clearFieldError('note')
            scheduleValidatedSave('note', value)
          }}
          onDateChange={(value) => {
            setMetadata((prev) => ({ ...prev, date: value }))
            if (fieldErrors.date) clearFieldError('date')
            scheduleValidatedSave('date', value, {
              dateMs: fromBillEditorDateInputValue(value),
            })
          }}
        />
      </section>
      <Rule />
      <section
        id="bill-people"
        aria-labelledby="bill-people-title"
        className="scroll-mt-24"
      >
        <h3
          id="bill-people-title"
          className="mb-2 font-display text-[17px] font-bold"
        >
          Кой беше на масата?
        </h3>
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
                  focus: guidanceFocus,
                  onAddGuestFocusChange: setAddGuestFocused,
                }
              : undefined
          }
        />
      </section>
    </>
  )

  return (
    <>
      <OcrActivityBar
        isUploading={receiptScan.isUploading}
        isScanning={receiptScan.isScanning}
      />
      <BillHeaderTitleSync title={bill.restaurantName} />
      <HostBillView
        billId={billId}
        data={data}
        phase={phase}
        onPhase={(next) => goToStep(stepForPhase(next))}
        guidance={guidance}
        onShareLink={
          onboardingActive
            ? (joinUrl) => interceptGuestShare(billId, joinUrl)
            : undefined
        }
        guidanceFocus={onboardingActive ? guidanceFocus : undefined}
        assemble={{
          title: restaurantField,
          body: assembleBody,
          blockers,
          primary:
            step === 1
              ? {
                  label: 'Към хората',
                  onClick: () => goToStep(2, { resetScroll: false }),
                  ready: true,
                }
              : {
                  label: 'Сложи я на масата',
                  onClick: () => goToStep(3),
                  ready: blockers.length === 0,
                },
          popToken: guidanceFocus.nextButtonPopToken,
          onPopEnd: guidanceFocus.onNextButtonPopEnd,
        }}
      />

      <Dialog
        open={receiptScan.preScanDialogOpen}
        onOpenChange={receiptScan.setPreScanDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вече има редове на бележката</DialogTitle>
            <DialogDescription>
              Да добавим ли разпознатите редове към тези, или да ги заменим?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => receiptScan.setPreScanDialogOpen(false)}
            >
              Отказ
            </Button>
            <Button
              variant="outline"
              onClick={() => receiptScan.handlePreScanChoice('replace')}
            >
              Замени
            </Button>
            <Button onClick={() => receiptScan.handlePreScanChoice('add')}>
              Добави
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={receiptScan.replaceConfirmOpen}
        onOpenChange={receiptScan.setReplaceConfirmOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ще изтриете сегашните редове</DialogTitle>
            <DialogDescription>
              Някои редове вече са разпределени между хората. Замяната ще изтрие
              редовете и отметките по тях. Продължавате ли?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => receiptScan.setReplaceConfirmOpen(false)}
            >
              Отказ
            </Button>
            <Button
              variant="destructive"
              onClick={receiptScan.handleReplaceConfirm}
            >
              Замени
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {receiptScan.activeScanId && (
        <ReceiptScanReviewSheet
          open={receiptScan.reviewSheetOpen}
          onOpenChange={receiptScan.setReviewSheetOpen}
          billId={billId}
          importMode={receiptScan.importMode}
          scanId={receiptScan.activeScanId}
          scanReviewGuidance={onboardingActive ? guidanceFocus : undefined}
        />
      )}
    </>
  )
}
