import { motion } from 'motion/react'
import { useState } from 'react'
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckIcon,
  ImageIcon,
  Loader2Icon,
  PlusIcon,
  ScanLineIcon,
} from 'lucide-react'
import { ItemEditSheet } from '#/components/bills/item-edit-sheet.tsx'
import { ReceiptTapToFullscreen } from '#/components/bills/receipt-tap-to-fullscreen.tsx'
import { Button } from '#/components/ui/button.tsx'
import type { useReceiptScan } from '#/hooks/use-receipt-scan.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { GuidanceTarget } from '#/lib/guidance-focus/guidance-target.tsx'
import type { GuidanceFocusHandle } from '#/lib/guidance-focus/use-guidance-focus.ts'
import { cn } from '#/lib/utils.ts'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

/**
 * Сглобяване: the receipt is built on the paper itself. Scan the paper
 * receipt (lines print in), or add and edit lines by hand.
 */
export function AssembleLines({
  billId,
  items,
  receiptScan,
  receiptUploaded,
  receiptUrl,
  itemsSubtotalCents,
  guidanceFocus,
}: {
  billId: Id<'bills'>
  items: Doc<'items'>[]
  receiptScan: ReturnType<typeof useReceiptScan>
  receiptUploaded: boolean
  receiptUrl: string | null | undefined
  itemsSubtotalCents: number
  guidanceFocus: GuidanceFocusHandle
}) {
  const [editing, setEditing] = useState<Doc<'items'> | null>(null)
  const [adding, setAdding] = useState(false)
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)
  const hasItems = sorted.length > 0
  const scannedTotal = receiptScan.completedScan?.receiptTotalCents

  const fileInputs = (
    <>
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
    </>
  )

  const uploadButtons = (
    <div className="flex w-full max-w-[300px] flex-col gap-2">
      <Button
        type="button"
        disabled={receiptScan.isOcrBusy}
        onClick={() => receiptScan.cameraInputRef.current?.click()}
      >
        <CameraIcon className="size-4" strokeWidth={1.75} aria-hidden />
        {receiptScan.isUploading ? 'Качване...' : 'Снимай бележката'}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={receiptScan.isOcrBusy}
        onClick={() => receiptScan.galleryInputRef.current?.click()}
      >
        <ImageIcon className="size-4" strokeWidth={1.75} aria-hidden />
        От галерията
      </Button>
    </div>
  )

  return (
    <section aria-label="Редове">
      {fileInputs}

      {receiptUploaded ? (
        <div className="mb-3 flex items-start gap-3">
          <div
            className={cn(
              'w-20 shrink-0 overflow-hidden border-2 border-dashed border-rule',
              receiptScan.isScanning && 'receipt-scan-image-active',
            )}
          >
            {receiptUrl ? (
              <ReceiptTapToFullscreen
                receiptUrl={receiptUrl}
                thumbnailClassName="block h-24 w-full border-0 object-cover object-top"
              />
            ) : (
              <div className="skeleton-print h-24 w-full" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-[12px] leading-relaxed">
            <p className="text-ink-muted">
              {receiptScan.isScanning
                ? 'Четем бележката. Редовете ще се отпечатат тук.'
                : hasItems
                  ? 'Снимката е тук, ако искате да сверите редовете.'
                  : 'Снимката е качена. Разпознайте редовете.'}
            </p>
            <GuidanceTarget stepId="scan-run-ocr" focus={guidanceFocus}>
              <Button
                type="button"
                size="sm"
                variant={hasItems ? 'outline' : 'default'}
                className="mt-2"
                disabled={receiptScan.isOcrBusy}
                aria-busy={receiptScan.isOcrBusy}
                onClick={receiptScan.handleScanButtonClick}
              >
                {receiptScan.isScanning ? (
                  <Loader2Icon
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden
                  />
                ) : (
                  <ScanLineIcon
                    className="size-4"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                )}
                {receiptScan.isScanning
                  ? 'Разпознаване...'
                  : hasItems
                    ? 'Разпознай отново'
                    : 'Разпознай редовете'}
              </Button>
            </GuidanceTarget>
          </div>
        </div>
      ) : null}

      {receiptScan.isScanning && !hasItems ? (
        <PrintingSkeleton />
      ) : !hasItems ? (
        <GuidanceTarget stepId="scan-upload" focus={guidanceFocus}>
          <div className="my-2 border-2 border-dashed border-rule px-4 py-8 text-center">
            <p className="font-display text-[15px] font-bold">Празна бележка</p>
            <p className="mx-auto mt-2 max-w-[32ch] text-[12px] leading-relaxed text-ink-muted">
              Снимайте касовата бележка и редовете ще се отпечатат тук. Или ги
              въведете на ръка.
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              {receiptUploaded ? null : uploadButtons}
              <GuidanceTarget stepId="items" focus={guidanceFocus}>
                <Button
                  type="button"
                  variant="link"
                  className="mt-1"
                  onClick={() => setAdding(true)}
                >
                  Добави ред на ръка
                </Button>
              </GuidanceTarget>
            </div>
          </div>
        </GuidanceTarget>
      ) : (
        <>
          <ul className="-mx-2">
            {sorted.map((item, index) => (
              <motion.li
                key={item._id}
                initial={{ opacity: 0, y: -8, clipPath: 'inset(0 0 100% 0)' }}
                animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(index, 12) * 0.05,
                }}
                className="list-none"
              >
                <button
                  type="button"
                  onClick={() => setEditing(item)}
                  className="min-h-[52px] w-full px-2 py-2 text-left hover:bg-paper-2"
                  aria-label={`Редактирай ${item.name}`}
                >
                  <span className="flex items-baseline">
                    <span className="min-w-0 font-medium">{item.name}</span>
                    <span className="leader" aria-hidden />
                    <span className="shrink-0 font-semibold">
                      {formatEur(item.unitPriceCents * item.quantity)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 block text-[11px] text-ink-muted',
                      item.unitPriceCents <= 0 &&
                        'font-semibold text-destructive',
                    )}
                  >
                    {item.unitPriceCents <= 0
                      ? 'Без цена. Докоснете, за да я въведете.'
                      : `${item.quantity} × ${formatEur(item.unitPriceCents)}`}
                  </span>
                </button>
              </motion.li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            <GuidanceTarget stepId="items" focus={guidanceFocus}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAdding(true)}
              >
                <PlusIcon className="size-4" strokeWidth={1.75} aria-hidden />
                Добави ред
              </Button>
            </GuidanceTarget>
            {!receiptUploaded ? (
              <Button
                type="button"
                variant="outline"
                disabled={receiptScan.isOcrBusy}
                onClick={() => receiptScan.cameraInputRef.current?.click()}
              >
                <CameraIcon className="size-4" strokeWidth={1.75} aria-hidden />
                Снимай бележката
              </Button>
            ) : null}
          </div>
          {scannedTotal !== undefined && scannedTotal > 0 ? (
            <ScanCheck
              linesCents={itemsSubtotalCents}
              receiptCents={scannedTotal}
            />
          ) : null}
          <p className="mt-3 text-[11px] text-ink-muted">
            Данък или такса за обслужване? Добавете ги като отделен ред.
          </p>
        </>
      )}

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
    </section>
  )
}

/** Sum of the lines against the total printed on the scanned receipt. */
function ScanCheck({
  linesCents,
  receiptCents,
}: {
  linesCents: number
  receiptCents: number
}) {
  const diff = linesCents - receiptCents
  return (
    <p
      className={cn(
        'mt-3 flex items-start gap-2 text-[11px] leading-snug',
        diff === 0 ? 'text-ink-muted' : 'font-semibold text-ink',
      )}
    >
      {diff === 0 ? (
        <CheckIcon
          className="mt-px size-3.5 shrink-0"
          strokeWidth={2.25}
          aria-hidden
        />
      ) : (
        <AlertTriangleIcon
          className="mt-px size-3.5 shrink-0 text-stamp"
          strokeWidth={2}
          aria-hidden
        />
      )}
      {diff === 0
        ? `Редовете дават ${formatEur(receiptCents)}, колкото е и на бележката.`
        : `Редовете дават ${formatEur(linesCents)}, а на бележката пише ${formatEur(receiptCents)}. Проверете ${diff > 0 ? 'за излишен ред' : 'дали липсва ред'}.`}
    </p>
  )
}

function PrintingSkeleton() {
  return (
    <div className="py-2" role="status" aria-label="Четем бележката">
      {[78, 52, 66, 44, 70, 38].map((width, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }}
          animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
          transition={{ delay: index * 0.22, duration: 0.25 }}
          className="flex items-center gap-3 py-2.5"
        >
          <span className="skeleton-print h-3" style={{ width: `${width}%` }} />
          <span className="flex-1 border-b-2 border-dotted border-paper-2" />
          <span className="skeleton-print h-3 w-14" />
        </motion.div>
      ))}
    </div>
  )
}
