import { useMutation, useQuery } from 'convex/react'
import { XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '#/components/ui/badge.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Checkbox } from '#/components/ui/checkbox.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { formatEur, parseEurInput } from '#/lib/format-currency.ts'
import {
  detectTotalsMismatch,
  sumItemsCents,
} from '#/lib/receipt-scan-utils.ts'
import { cn } from '#/lib/utils.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export interface ReceiptScanReviewSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  billId: Id<'bills'>
  importMode: 'add' | 'replace'
  scanId: Id<'receiptScans'>
}

interface ReviewRow {
  name: string
  priceInput: string
  quantity: string
  confidence: 'high' | 'low'
  checked: boolean
}

function formatEurInputValue(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function ReceiptScanReviewSheet({
  open,
  onOpenChange,
  billId,
  importMode,
  scanId,
}: ReceiptScanReviewSheetProps) {
  const scan = useQuery(api.receiptScan.getLatestScan, { billId })
  const importScannedItems = useMutation(api.receiptScan.importScannedItems)
  const dismissScan = useMutation(api.receiptScan.dismissScan)

  const [rows, setRows] = useState<ReviewRow[]>([])
  const [restaurantName, setRestaurantName] = useState('')
  const [updateRestaurantName, setUpdateRestaurantName] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const initializedScanIdRef = useRef<Id<'receiptScans'> | null>(null)

  const scanReady = scan && scan._id === scanId ? scan : undefined

  useEffect(() => {
    if (!scanReady) return
    if (initializedScanIdRef.current === scanReady._id) return
    initializedScanIdRef.current = scanReady._id
    const extractedItems = scanReady.extractedItems ?? []
    setRows(
      extractedItems.map((item) => ({
        name: item.name,
        priceInput: formatEurInputValue(item.unitPriceCents),
        quantity: String(item.quantity),
        confidence: item.confidence,
        checked: true,
      })),
    )
    setRestaurantName(scanReady.extractedRestaurantName ?? '')
    setUpdateRestaurantName(Boolean(scanReady.extractedRestaurantName))
  }, [scanReady])

  useEffect(() => {
    if (!open) initializedScanIdRef.current = null
  }, [open])

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    )
  }

  const allChecked = rows.length > 0 && rows.every((r) => r.checked)
  const checkedCount = rows.filter((r) => r.checked).length

  const parsedRows = rows.map((row) => ({
    name: row.name,
    unitPriceCents: parseEurInput(row.priceInput),
    quantity: Math.max(1, Number.parseInt(row.quantity, 10) || 1),
    confidence: row.confidence,
  }))
  const itemsTotalCents = sumItemsCents(parsedRows)
  const receiptTotalCents = scanReady?.receiptTotalCents
  const mismatch = detectTotalsMismatch(itemsTotalCents, receiptTotalCents)

  function toggleSelectAll() {
    setRows((prev) => prev.map((r) => ({ ...r, checked: !allChecked })))
  }

  async function handleCancel() {
    await dismissScan({ scanId })
    onOpenChange(false)
  }

  async function handleImport() {
    const selectedRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.checked && row.name.trim().length > 0)

    if (selectedRows.length === 0) {
      toast.error('Изберете поне един артикул за импортиране')
      return
    }

    setIsSubmitting(true)
    try {
      await importScannedItems({
        scanId,
        mode: importMode,
        selectedIndexes: selectedRows.map(({ index }) => index),
        updateRestaurantName,
        restaurantName: updateRestaurantName
          ? restaurantName.trim()
          : undefined,
        items: selectedRows.map(({ row }) => ({
          name: row.name.trim(),
          unitPriceCents: parseEurInput(row.priceInput),
          quantity: Math.max(1, Number.parseInt(row.quantity, 10) || 1),
        })),
      })
      await dismissScan({ scanId })
      toast.success(`${selectedRows.length} артикула добавени`)
      onOpenChange(false)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Неуспешен импорт на артикулите.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="mx-auto flex max-h-[85vh] w-full max-w-lg flex-col gap-0 overflow-hidden rounded-t-xl border-t bg-background p-0 pb-[env(safe-area-inset-bottom)] shadow-lg"
      >
        <SheetClose className="absolute top-4 right-4 z-10 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetClose>

        <SheetHeader className="text-center">
          <SheetTitle className="px-8 text-center">
            Преглед на разпознатите артикули
          </SheetTitle>
        </SheetHeader>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4',
            scanReady === undefined && 'min-h-[40vh]',
          )}
        >
          {scanReady === undefined && (
            <div className="flex flex-1 items-center justify-center py-10">
              <p className="text-sm text-muted-foreground">Зареждане...</p>
            </div>
          )}

          {scanReady && (scanReady.extractedRestaurantName ?? '') !== '' && (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <Label htmlFor="scan-restaurant-name">Ресторант</Label>
              <Input
                id="scan-restaurant-name"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="h-11"
              />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={updateRestaurantName}
                  onCheckedChange={(v) => setUpdateRestaurantName(v === true)}
                />
                Обнови името на ресторанта
              </label>
            </div>
          )}

          {scanReady &&
            rows.length === 0 &&
            (scanReady.extractedItems?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                Няма разпознати артикули.
              </p>
            )}

          {rows.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {rows.length} разпознати артикула
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={toggleSelectAll}
              >
                {allChecked ? 'Размаркирай всички' : 'Маркирай всички'}
              </Button>
            </div>
          )}

          {rows.map((row, index) => (
            <div
              key={index}
              className={cn(
                'flex items-start gap-2 rounded-lg border p-3',
                row.confidence === 'low' &&
                  'border-amber-400 bg-amber-50 dark:border-amber-500 dark:bg-amber-950/40',
              )}
            >
              <Checkbox
                checked={row.checked}
                onCheckedChange={(v) =>
                  updateRow(index, { checked: v === true })
                }
                className="mt-3"
              />
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={row.name}
                    onChange={(e) => updateRow(index, { name: e.target.value })}
                    placeholder="Наименование"
                    className="h-10 flex-1"
                  />
                  {row.confidence === 'low' && (
                    <Badge
                      variant="outline"
                      className="border-amber-500 text-amber-700 dark:text-amber-300"
                    >
                      ?
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={row.priceInput}
                    onChange={(e) =>
                      updateRow(index, { priceInput: e.target.value })
                    }
                    inputMode="decimal"
                    placeholder="Цена (€)"
                    className="h-10 flex-1"
                  />
                  <span className="text-muted-foreground">×</span>
                  <Input
                    value={row.quantity}
                    onChange={(e) =>
                      updateRow(index, { quantity: e.target.value })
                    }
                    inputMode="numeric"
                    placeholder="Бр."
                    className="h-10 w-16"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {scanReady && (
          <SheetFooter className="mt-0 gap-3 border-t">
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Сумата на артикулите
                </span>
                <span className="font-medium tabular-nums">
                  {formatEur(itemsTotalCents)}
                </span>
              </div>
              {receiptTotalCents !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Общо на бележка</span>
                  <span className="font-medium tabular-nums">
                    {formatEur(receiptTotalCents)}
                  </span>
                </div>
              )}
              {mismatch && (
                <p className="text-xs font-medium text-amber-600">
                  Сумите не съвпадат — проверете артикулите
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 flex-1"
                onClick={() => void handleCancel()}
                disabled={isSubmitting}
              >
                Отказ
              </Button>
              <Button
                type="button"
                className="h-11 flex-1"
                onClick={() => void handleImport()}
                disabled={isSubmitting || checkedCount === 0}
              >
                Импортирай избраните ({checkedCount})
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
