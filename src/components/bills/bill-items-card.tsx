import {
  CameraIcon,
  ChevronRightIcon,
  ImageIcon,
  KeyboardIcon,
  Loader2Icon,
  PlusIcon,
  ScanLineIcon,
  ShoppingBagIcon,
} from 'lucide-react'
import { useState } from 'react'
import { ItemEditSheet } from '#/components/bills/item-edit-sheet.tsx'
import { ReceiptTapToFullscreen } from '#/components/bills/receipt-tap-to-fullscreen.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import type { useReceiptScan } from '#/hooks/use-receipt-scan.ts'
import { ICON } from '#/lib/app-icons.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { GuidanceTarget } from '#/lib/guidance-focus/guidance-target.tsx'
import type { GuidanceFocusHandle } from '#/lib/guidance-focus/use-guidance-focus.ts'
import { cn } from '#/lib/utils.ts'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface BillItemsCardProps {
  billId: Id<'bills'>
  items: Doc<'items'>[]
  readOnly: boolean
  receiptScan: ReturnType<typeof useReceiptScan>
  receiptUploaded: boolean
  receiptUrl: string | null | undefined
  itemsSubtotalCents: number
  guidanceFocus: GuidanceFocusHandle
}

/** Step 1 · Сметка: every way to put items on the bill, in one place. */
export function BillItemsCard({
  billId,
  items,
  readOnly,
  receiptScan,
  receiptUploaded,
  receiptUrl,
  itemsSubtotalCents,
  guidanceFocus,
}: BillItemsCardProps) {
  const [editing, setEditing] = useState<Doc<'items'> | null>(null)
  const [adding, setAdding] = useState(false)
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)
  const hasItems = sorted.length > 0

  const uploadButtons = (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 flex-1"
        disabled={receiptScan.isOcrBusy || readOnly}
        onClick={() => receiptScan.cameraInputRef.current?.click()}
      >
        <CameraIcon className={ICON.button} aria-hidden />
        {receiptScan.isUploading ? 'Качване...' : 'Снимай'}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="h-11 flex-1"
        disabled={receiptScan.isOcrBusy || readOnly}
        onClick={() => receiptScan.galleryInputRef.current?.click()}
      >
        <ImageIcon className={ICON.button} aria-hidden />
        {receiptScan.isUploading ? 'Качване...' : 'От галерията'}
      </Button>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBagIcon className={ICON.section} aria-hidden />
          Артикули
          {hasItems ? (
            <span className="text-sm font-normal text-muted-foreground">
              ({sorted.length})
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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

        {receiptUploaded ? (
          <div
            className={cn(
              'overflow-hidden rounded-lg border border-dashed',
              receiptScan.isScanning && 'receipt-scan-image-active',
            )}
          >
            {receiptUrl ? (
              <ReceiptTapToFullscreen
                receiptUrl={receiptUrl}
                thumbnailClassName="block max-h-48 w-full border-0 object-cover object-top"
              />
            ) : (
              <p className="p-4 text-sm text-muted-foreground">
                Зареждане на снимката...
              </p>
            )}
          </div>
        ) : null}

        {!readOnly && receiptUploaded ? (
          <GuidanceTarget stepId="scan-run-ocr" focus={guidanceFocus}>
            <Button
              type="button"
              variant={hasItems ? 'outline' : 'default'}
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
                : hasItems
                  ? 'Разпознай отново'
                  : 'Разпознай артикули'}
            </Button>
          </GuidanceTarget>
        ) : null}

        {!readOnly && !receiptUploaded && !hasItems ? (
          <GuidanceTarget stepId="scan-upload" focus={guidanceFocus}>
            <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
              <p className="text-sm text-muted-foreground">
                Снимайте касовата бележка и артикулите ще се попълнят
                автоматично — или ги въведете ръчно.
              </p>
              {uploadButtons}
            </div>
          </GuidanceTarget>
        ) : null}

        {hasItems ? (
          <ul className="flex flex-col divide-y rounded-lg border">
            {sorted.map((item) => (
              <li key={item._id}>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setEditing(item)}
                  className="tap-feedback flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left disabled:cursor-default"
                  aria-label={`Редактирай ${item.name}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {item.name}
                    </span>
                    <span
                      className={cn(
                        'text-xs text-muted-foreground',
                        item.unitPriceCents <= 0 && 'text-destructive',
                      )}
                    >
                      {item.unitPriceCents <= 0
                        ? 'Без цена'
                        : `${formatEur(item.unitPriceCents)} × ${item.quantity}`}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="money text-sm font-medium">
                      {formatEur(item.unitPriceCents * item.quantity)}
                    </span>
                    {!readOnly ? (
                      <ChevronRightIcon
                        className="size-4 text-muted-foreground"
                        aria-hidden
                      />
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {!readOnly ? (
          <GuidanceTarget stepId="items" focus={guidanceFocus}>
            <Button
              type="button"
              variant={hasItems ? 'outline' : 'secondary'}
              className="h-11 w-full"
              onClick={() => setAdding(true)}
            >
              {hasItems ? (
                <PlusIcon className={ICON.button} aria-hidden />
              ) : (
                <KeyboardIcon className={ICON.button} aria-hidden />
              )}
              {hasItems ? 'Добави артикул' : 'Въведи артикул ръчно'}
            </Button>
          </GuidanceTarget>
        ) : null}

        {hasItems ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Сума на артикулите</span>
            <span className="money font-medium">
              {formatEur(itemsSubtotalCents)}
            </span>
          </div>
        ) : null}

        {!readOnly && hasItems && !receiptUploaded ? (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer py-1">
              Добави артикули от снимка на бележката
            </summary>
            <div className="pt-2">{uploadButtons}</div>
          </details>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Данък или такса за обслужване? Добавете ги като отделен артикул.
        </p>
      </CardContent>

      <ItemEditSheet
        open={adding || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdding(false)
            setEditing(null)
          }
        }}
        billId={billId}
        item={editing ?? undefined}
      />
    </Card>
  )
}
