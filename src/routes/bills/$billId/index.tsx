import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
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
import { useEffect } from 'react'
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
import {
  clampBillEditorStep,
  fromBillEditorDateInputValue,
  shouldRedirectFinalBillToSummary,
} from '#/lib/bill-editing-controller.ts'
import { validateBillMetadataField } from '#/lib/bill-metadata-schema.ts'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { useBillEditorController } from '#/hooks/use-bill-editor-controller.ts'
import { BillHeaderTitleSync } from '#/components/layout/bill-header-title.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
import { ContentRouteChoice } from '#/components/host-onboarding/content-route-choice.tsx'
import { ReceiptTapToFullscreen } from '#/components/bills/receipt-tap-to-fullscreen.tsx'
import { StickyGuidanceBar } from '#/components/host-onboarding/sticky-guidance-bar.tsx'
import { GuidanceTarget } from '#/lib/guidance-focus/guidance-target.tsx'
import { HOST_ONBOARDING_STEP_BAR } from '../../../../shared/host-onboarding-messages.ts'
import { buildNoIndexHead } from '#/lib/site-meta.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

type BillData = NonNullable<FunctionReturnType<typeof api.bills.get>>

export const Route = createFileRoute('/bills/$billId/')({
  validateSearch: (search: Record<string, unknown>) => ({
    step: clampBillEditorStep(search.step),
  }),
  head: () => buildNoIndexHead('Сметка'),
  component: BillEditor,
})

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
    assignments,
    labels,
    metadata,
    fieldErrors,
    breakdownOpen,
    setBreakdownOpen,
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
      <OcrActivityBar
        isUploading={receiptScan.isUploading}
        isScanning={receiptScan.isScanning}
      />
      <BillHeaderTitleSync title={bill.restaurantName} />
      <div className="sticky-surface sticky top-14 z-30 border-b">
        <BillStepsBar
          step={step}
          completed={derived.stepCompletion}
          onStepSelect={goToStep}
          guidanceSignal={stepBarGuidanceNode}
        />
        <StickyGuidanceBar
          billId={billId}
          panel={guidancePanel}
          sessionVersion={billSessionVersion}
          onSessionChange={refreshBillSession}
        />
      </div>
      <div
        key={step}
        className={cn(
          'page-container animate-in fade-in slide-in-from-bottom-2 duration-[250ms]',
          receiptScan.isOcrBusy && 'pt-1',
        )}
      >
        <div className="flex flex-col gap-4">
          {step === 1 && (
            <>
              {showContentRouteChoice ? (
                <GuidanceTarget stepId="content-route" focus={guidanceFocus}>
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
                    <GuidanceTarget stepId="scan-upload" focus={guidanceFocus}>
                      <button
                        type="button"
                        onClick={() =>
                          receiptScan.galleryInputRef.current?.click()
                        }
                        disabled={receiptScan.isOcrBusy}
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
                  ) : receiptUrl ? (
                    <div
                      className={cn(
                        'overflow-hidden rounded-lg border border-dashed',
                        receiptScan.isScanning && 'receipt-scan-image-active',
                      )}
                    >
                      <ReceiptTapToFullscreen
                        receiptUrl={receiptUrl}
                        thumbnailClassName="block w-full border-0"
                      />
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Зареждане на снимката...
                    </p>
                  )}
                  <input
                    ref={receiptScan.galleryInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    className="hidden"
                    onChange={receiptScan.handleReceiptChange}
                  />
                  <input
                    ref={receiptScan.cameraInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    capture="environment"
                    className="hidden"
                    onChange={receiptScan.handleReceiptChange}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        receiptScan.galleryInputRef.current?.click()
                      }
                      disabled={receiptScan.isOcrBusy}
                      className="tap-feedback flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground disabled:opacity-50"
                    >
                      <ImageIcon className="size-4" aria-hidden />
                      {receiptScan.isUploading ? 'Качване...' : 'От галерията'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        receiptScan.cameraInputRef.current?.click()
                      }
                      disabled={receiptScan.isOcrBusy}
                      className="tap-feedback flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground disabled:opacity-50"
                    >
                      <CameraIcon className="size-4" aria-hidden />
                      {receiptScan.isUploading ? 'Качване...' : 'Снимай'}
                    </button>
                  </div>
                  {receiptUploaded ? (
                    <GuidanceTarget stepId="scan-run-ocr" focus={guidanceFocus}>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full"
                        disabled={receiptScan.isOcrBusy}
                        aria-busy={receiptScan.isOcrBusy}
                        onClick={receiptScan.handleScanButtonClick}
                      >
                        {receiptScan.isScanning ? (
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
                        {receiptScan.isScanning
                          ? 'Разпознаване…'
                          : 'Разпознай артикули'}
                      </Button>
                    </GuidanceTarget>
                  ) : null}
                </CardContent>
              </Card>

              <GuidanceTarget stepId="restaurant" focus={guidanceFocus}>
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
                      itemsSubtotalCents={derived.itemsSubtotalCents}
                      value={metadata.tip}
                      onValueChange={(value) => {
                        setMetadata((prev) => ({ ...prev, tip: value }))
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
                        value={metadata.restaurantName}
                        onChange={(event) => {
                          const value = event.target.value
                          setMetadata((prev) => ({
                            ...prev,
                            restaurantName: value,
                          }))
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
                    shareGuidance={onboardingActive ? guidanceFocus : undefined}
                    allocationGuidance={
                      onboardingActive ? guidanceFocus : undefined
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

          {step === 4 && <BillSummaryContent billId={billId} embedded />}
        </div>
      </div>

      {!receiptScan.reviewSheetOpen && (
        <StepNavBar
          step={step}
          onStepChange={goToStep}
          totalCents={derived.totals.billTotalCents}
          unassignedCount={derived.unassignedItemsCount}
          onTotalClick={() => setBreakdownOpen(true)}
          nextButtonPopToken={guidanceFocus.nextButtonPopToken}
          onNextButtonPopEnd={guidanceFocus.onNextButtonPopEnd}
        />
      )}

      <TotalsBreakdownSheet
        open={breakdownOpen}
        onOpenChange={setBreakdownOpen}
        totals={derived.totals}
        participants={participants}
        labels={labels}
      />

      <Dialog
        open={receiptScan.preScanDialogOpen}
        onOpenChange={receiptScan.setPreScanDialogOpen}
      >
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
            <DialogTitle>Ще изтриете съществуващите артикули</DialogTitle>
            <DialogDescription>
              Артикулите имат разпределения между участници. Замяната ще изтрие
              съществуващите артикули и разпределенията им. Продължавате ли?
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
