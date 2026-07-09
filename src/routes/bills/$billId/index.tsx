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
import { ItemList } from '#/components/bills/item-list.tsx'
import { BillInviteCard } from '#/components/bills/bill-invite-card.tsx'
import { ParticipantList } from '#/components/bills/participant-list.tsx'
import { ReceiptScanReviewSheet } from '#/components/bills/receipt-scan-review-sheet.tsx'
import { StickyTotalsBar } from '#/components/bills/sticky-totals-bar.tsx'
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
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { parseEurInput } from '#/lib/format-currency.ts'
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

export const Route = createFileRoute('/bills/$billId/')({
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

function formatEurInputValue(cents: number): string {
  if (cents === 0) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
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

  const receiptUrl = useQuery(api.files.getReceiptUrl, { billId })

  const {
    galleryInputRef,
    cameraInputRef,
    isUploading,
    isScanning,
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
  const initializedBillId = useRef(bill._id)

  useEffect(() => {
    if (initializedBillId.current !== bill._id) {
      initializedBillId.current = bill._id
      setRestaurantName(bill.restaurantName)
      setDate(toDateInputValue(bill.date))
      setNote(bill.note ?? '')
      setTip(formatEurInputValue(bill.tipCents ?? 0))
    }
  }, [bill])

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleSave(
    patch: Partial<{
      restaurantName: string
      date: number
      note: string
      tipCents: number
    }>,
  ) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void updateBill({ billId, ...patch }).catch((error) => {
        toast.error(getConvexErrorMessage(error))
      })
    }, 500)
  }
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const labels = useMemo(
    () => buildParticipantLabels(participants),
    [participants],
  )

  return (
    <div className="page-container">
      <BillHeaderTitleSync title={bill.restaurantName} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptIcon className={ICON.section} aria-hidden />
              Данни за сметката
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="restaurantName">Ресторант</Label>
              <Input
                id="restaurantName"
                value={restaurantName}
                onChange={(e) => {
                  setRestaurantName(e.target.value)
                  scheduleSave({ restaurantName: e.target.value })
                }}
                placeholder="Напр. Механа Крайречна"
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="date">Дата</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value)
                  scheduleSave({ date: fromDateInputValue(e.target.value) })
                }}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="note">Бележка</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => {
                  setNote(e.target.value)
                  scheduleSave({ note: e.target.value })
                }}
                placeholder="Незадължителна бележка"
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tip">Бакшиш</Label>
              <Input
                id="tip"
                inputMode="decimal"
                value={tip}
                onChange={(e) => {
                  setTip(e.target.value)
                  scheduleSave({ tipCents: parseEurInput(e.target.value) })
                }}
                placeholder="0,00"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Разделя се поравно между всички участници.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Снимка на касова бележка</Label>
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
                  disabled={isUploading}
                  className="tap-feedback flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground disabled:opacity-50"
                >
                  <ImageIcon className="size-4" aria-hidden />
                  {isUploading ? 'Качване...' : 'От галерията'}
                </button>
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isUploading}
                  className="tap-feedback flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground disabled:opacity-50"
                >
                  <CameraIcon className="size-4" aria-hidden />
                  {isUploading ? 'Качване...' : 'Снимай'}
                </button>
              </div>
              {bill.receiptStorageId && (
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={isScanning}
                    aria-busy={isScanning}
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
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBagIcon className={ICON.section} aria-hidden />
              Артикули
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Добавете данък като отделен артикул. Бакшишът се въвежда по-горе.
            </p>
            <ItemList
              billId={billId}
              items={items}
              participants={participants}
              assignments={assignments}
              labels={labels}
            />
          </CardContent>
        </Card>
      </div>

      {!reviewSheetOpen ? (
        <StickyTotalsBar
          billId={billId}
          tipCents={parseEurInput(tip)}
          participants={participants}
          items={items}
          assignments={assignments}
          payments={payments}
        />
      ) : null}

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
    </div>
  )
}
