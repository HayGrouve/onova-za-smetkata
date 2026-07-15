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
import { useEffect, useMemo, useRef, useState } from 'react'
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
import {
  calculateItemsSubtotalCents,
  formatEurInputValue,
} from '../../../../shared/tip-calculations.ts'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { parseTipInputToCents, validateBillMetadataField } from '#/lib/bill-metadata-schema.ts'
import type { BillMetadataPatchInput } from '#/lib/bill-metadata-schema.ts'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'
import { useRequireHostAuth } from '#/hooks/use-require-host-auth.ts'
import { useReceiptScan } from '#/hooks/use-receipt-scan.ts'
import { BillHeaderTitleSync } from '#/components/layout/bill-header-title.tsx'
import { Skeleton } from '#/components/ui/skeleton.tsx'
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

  const { step } = Route.useSearch()
  const navigate = Route.useNavigate()

  function goToStep(next: BillStep) {
    void navigate({ search: { step: next }, resetScroll: true })
  }

  const receiptUrl = useQuery(api.files.getReceiptUrl, { billId })

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
  } = useReceiptScan({ billId, items, assignments })

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
  const initializedBillId = useRef(bill._id)
  const appliedRestaurantFromScanRef = useRef<Id<'receiptScans'> | null>(null)

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

  const totals = useMemo(
    () =>
      calculateBillTotals({
        participants: participants.map((p) => ({
          id: p._id,
          sortOrder: p.sortOrder,
        })),
        items: items.map((i) => ({
          id: i._id,
          unitPriceCents: i.unitPriceCents,
          quantity: i.quantity,
        })),
        assignments: assignments.map((a) => ({
          itemId: a.itemId,
          participantId: a.participantId,
          units: a.units,
        })),
        payments: payments.map((p) => ({
          participantId: p.participantId,
          amountCents: p.amountCents,
        })),
        tipCents: tipCentsForTotals,
      }),
    [participants, items, assignments, payments, tipCentsForTotals],
  )

  const unassignedItemsCount = useMemo(() => {
    return items.filter((item) => {
      const itemAssignments = assignments.filter((a) => a.itemId === item._id)
      if (itemAssignments.length === 0) return true
      // Legacy assignments without units mean the whole item is shared.
      const usesUnits = itemAssignments.some((a) => a.units !== undefined)
      if (!usesUnits) return false
      const assignedUnits = itemAssignments.reduce(
        (sum, a) => sum + (a.units ?? 0),
        0,
      )
      return assignedUnits < item.quantity
    }).length
  }, [items, assignments])

  return (
    <>
      <OcrActivityBar isUploading={isUploading} isScanning={isScanning} />
      <BillHeaderTitleSync title={bill.restaurantName} />
      <BillStepsBar step={step} onStepSelect={goToStep} />
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
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ReceiptIcon className={ICON.section} aria-hidden />
                    Касова бележка
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {!bill.receiptStorageId ? (
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={isOcrBusy}
                      className={cn(
                        'tap-feedback flex w-full flex-col items-center gap-3 rounded-lg border border-dashed p-4 text-left',
                        'cursor-pointer transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <div className="flex items-center gap-2 self-start text-sm font-medium">
                        <ReceiptIcon className={ICON.section} aria-hidden />
                        Снимка на касова бележка
                      </div>
                      <p className="self-start text-sm text-muted-foreground">
                        Качете снимка на бележката, за да разпознаете
                        артикулите автоматично.
                      </p>
                    </button>
                  ) : (
                    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-4">
                      <div className="flex items-center gap-2 self-start text-sm font-medium">
                        <ReceiptIcon className={ICON.section} aria-hidden />
                        Снимка на касова бележка
                      </div>
                      {receiptUrl && (
                        <img
                          src={receiptUrl}
                          alt="Касова бележка"
                          className={cn(
                            'max-h-64 w-full rounded-md border object-contain',
                            isScanning && 'receipt-scan-image-active',
                          )}
                        />
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
                  {bill.receiptStorageId && (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
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
                  )}
                </CardContent>
              </Card>

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
                      const validated = validateBillMetadataField('tip', value)
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
                      Попълва се автоматично при разпознаване на бележката, ако
                      името е видимо на снимката.
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
                  readOnly={bill.status === 'final'}
                  suggestedGroupName={bill.restaurantName}
                />
                <div className="mt-4">
                  <BillInviteCard
                    billId={billId}
                    shareToken={bill.shareToken}
                    disabled={participants.length === 0}
                  />
                </div>
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
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBagIcon className={ICON.section} aria-hidden />
                    Артикули
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
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

      {step < 4 && !reviewSheetOpen && (
        <StepNavBar
          step={step}
          onStepChange={goToStep}
          totalCents={totals.billTotalCents}
          unassignedCount={unassignedItemsCount}
          onTotalClick={() => setBreakdownOpen(true)}
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
        />
      )}
    </>
  )
}
