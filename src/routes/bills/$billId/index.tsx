import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { CameraIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ItemList } from '#/components/bills/item-list.tsx'
import { ParticipantList } from '#/components/bills/participant-list.tsx'
import { StickyTotalsBar } from '#/components/bills/sticky-totals-bar.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { buildParticipantLabels } from '#/lib/participant-labels.ts'
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const receiptUrl = useQuery(
    api.files.getUrl,
    bill.receiptStorageId ? { storageId: bill.receiptStorageId } : 'skip',
  )

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
      const uploadUrl = await generateUploadUrl()
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      const { storageId } = (await result.json()) as {
        storageId: Id<'_storage'>
      }
      await updateBill({ billId, receiptStorageId: storageId })
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
                accept="image/*"
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
    </div>
  )
}
