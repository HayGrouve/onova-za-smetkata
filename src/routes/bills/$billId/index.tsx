import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { CameraIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ItemList } from '#/components/bills/item-list.tsx'
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
import { prepareReceiptImage } from '#/lib/prepare-receipt-image.ts'
import { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'

type BillData = NonNullable<FunctionReturnType<typeof api.bills.get>>

export const Route = createFileRoute('/bills/$billId/')({
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
  const data = useQuery(api.bills.get, { billId })

  if (data === undefined) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-muted-foreground">
        Зареждане...
      </div>
    )
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-muted-foreground">
        Сметката не е намерена.
      </div>
    )
  }

  return <BillEditorContent billId={billId} data={data} />
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
  const generateUploadUrl = useMutation(api.files.generateUploadUrl)
  const startScan = useMutation(api.receiptScan.startScan)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const receiptUrl = useQuery(
    api.files.getUrl,
    bill.receiptStorageId ? { storageId: bill.receiptStorageId } : 'skip',
  )

  const latestScan = useQuery(api.receiptScan.getLatestScan, { billId })
  const isScanning =
    latestScan?.status === 'pending' || latestScan?.status === 'processing'
  const [preScanDialogOpen, setPreScanDialogOpen] = useState(false)
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false)
  const [importMode, setImportMode] = useState<'add' | 'replace'>('add')
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false)
  const [activeScanId, setActiveScanId] = useState<Id<'receiptScans'> | null>(
    null,
  )
  const handledScanIdRef = useRef<Id<'receiptScans'> | null>(null)
  const erroredScanIdRef = useRef<Id<'receiptScans'> | null>(null)

  useEffect(() => {
    if (!latestScan) return
    if (
      latestScan.status === 'done' &&
      handledScanIdRef.current !== latestScan._id
    ) {
      handledScanIdRef.current = latestScan._id
      setActiveScanId(latestScan._id)
      setReviewSheetOpen(true)
    }
    if (
      latestScan.status === 'failed' &&
      erroredScanIdRef.current !== latestScan._id
    ) {
      erroredScanIdRef.current = latestScan._id
      toast.error(
        latestScan.errorMessage ?? 'Неуспешно разпознаване на бележката',
      )
    }
  }, [latestScan])

  function beginScan(mode: 'add' | 'replace') {
    setImportMode(mode)
    void startScan({ billId })
  }

  function handleScanButtonClick() {
    if (items.length > 0) {
      setPreScanDialogOpen(true)
    } else {
      beginScan('add')
    }
  }

  function handlePreScanChoice(mode: 'add' | 'replace') {
    setPreScanDialogOpen(false)
    if (mode === 'replace' && assignments.length > 0) {
      setReplaceConfirmOpen(true)
      return
    }
    beginScan(mode)
  }

  function handleReplaceConfirm() {
    setReplaceConfirmOpen(false)
    beginScan('replace')
  }

  const [restaurantName, setRestaurantName] = useState(bill.restaurantName)
  const [date, setDate] = useState(() => toDateInputValue(bill.date))
  const [note, setNote] = useState(bill.note ?? '')
  const initializedBillId = useRef(bill._id)

  useEffect(() => {
    if (initializedBillId.current !== bill._id) {
      initializedBillId.current = bill._id
      setRestaurantName(bill.restaurantName)
      setDate(toDateInputValue(bill.date))
      setNote(bill.note ?? '')
    }
  }, [bill])

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleSave(
    patch: Partial<{ restaurantName: string; date: number; note: string }>,
  ) {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      void updateBill({ billId, ...patch })
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

  async function handleReceiptChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const { blob, contentType } = await prepareReceiptImage(file)
      const uploadUrl = await generateUploadUrl()
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': contentType },
        body: blob,
      })
      if (!result.ok) {
        const errorText = await result.text()
        throw new Error(errorText || `Upload failed (${result.status})`)
      }
      const { storageId } = (await result.json()) as {
        storageId: Id<'_storage'>
      }
      if (!storageId) {
        throw new Error('Upload succeeded but no storageId returned')
      }
      await updateBill({ billId, receiptStorageId: storageId })
      toast.success('Снимката е качена')
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Неуспешно качване на снимката.'
      toast.error(message)
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-32">
      <h1 className="mb-4 text-xl font-bold">Редактиране на сметка</h1>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Данни за сметката</CardTitle>
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
              <Label>Снимка на касова бележка</Label>
              {receiptUrl && (
                <img
                  src={receiptUrl}
                  alt="Касова бележка"
                  className="max-h-64 w-full rounded-md border object-contain"
                />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                capture="environment"
                className="hidden"
                onChange={handleReceiptChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex h-11 items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground disabled:opacity-50"
              >
                <CameraIcon className="size-4" />
                {isUploading
                  ? 'Качване...'
                  : receiptUrl
                    ? 'Смени снимката'
                    : 'Добави снимка'}
              </button>
              {bill.receiptStorageId && (
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11"
                    disabled={isScanning}
                    onClick={handleScanButtonClick}
                  >
                    {isScanning ? 'Разпознаване…' : 'Разпознай артикули'}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Използва AI (~€0.01 на scan)
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Участници</CardTitle>
          </CardHeader>
          <CardContent>
            <ParticipantList
              billId={billId}
              participants={participants}
              labels={labels}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Артикули</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              Добавете данък и бакшиш като отделни артикули.
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

      <StickyTotalsBar
        billId={billId}
        participants={participants}
        items={items}
        assignments={assignments}
        payments={payments}
      />

      <Dialog open={preScanDialogOpen} onOpenChange={setPreScanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вече има артикули в сметката</DialogTitle>
            <DialogDescription>
              Искате ли да добавите разпознатите артикули към
              съществуващите, или да ги замените?
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
              Артикулите имат разпределения между участници. Замяната ще
              изтрие съществуващите артикули и разпределенията им.
              Продължавате ли?
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
