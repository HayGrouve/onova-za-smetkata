import {
  CameraIcon,
  CheckIcon,
  ImageIcon,
  PlusIcon,
  ScanLineIcon,
  Trash2Icon,
} from 'lucide-react'
import { useRef } from 'react'
import { ReceiptTapToFullscreen } from '#/components/bills/receipt-tap-to-fullscreen.tsx'
import { Button } from '#/components/ui/button.tsx'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu.tsx'
import type { BillReceipt } from '#/hooks/use-receipt-scan.ts'
import { cn } from '#/lib/utils.ts'
import type { Id } from '../../../convex/_generated/dataModel'

/**
 * The bill's receipt photos in a row, oldest first. Tap one to see it full
 * size, read it (again) or take it off the bill; the last tile adds another.
 */
export function ReceiptStrip({
  receipts,
  scanningReceiptId,
  busy,
  canAdd,
  onScan,
  onRemove,
  onTakePhoto,
  onPickFromGallery,
}: {
  receipts: BillReceipt[]
  scanningReceiptId: string | null
  /** Uploading or reading: no receipt may change meanwhile. */
  busy: boolean
  canAdd: boolean
  onScan: (receiptId: Id<'billReceipts'>) => void
  /** Confirms first, then calls `onConfirmed`; true once the photo is gone. */
  onRemove: (
    receiptId: Id<'billReceipts'>,
    onConfirmed: () => void,
  ) => Promise<boolean>
  onTakePhoto: () => void
  onPickFromGallery: () => void
}) {
  const count = receipts.length
  const listRef = useRef<HTMLUListElement>(null)

  /** The removed tile took focus with it: hand it to the strip's first tile. */
  function refocusStrip() {
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLElement>('button')?.focus()
    })
  }

  return (
    <ul
      ref={listRef}
      aria-label="Снимки на бележки"
      className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1"
    >
      {receipts.length === 0 ? (
        // Just uploaded: the list catches up in a moment.
        <li className="w-20 shrink-0 border-2 border-dashed border-rule">
          <div className="skeleton-print h-24 w-full" />
        </li>
      ) : null}
      {receipts.map((receipt, index) => {
        const imported = receipt.importedAt !== undefined
        const scanning = scanningReceiptId === receipt._id
        const position = `Бележка ${index + 1} от ${count}`
        const label = imported ? `${position}, редовете са добавени` : position
        return (
          <li key={receipt._id} className="relative shrink-0">
            <div
              className={cn(
                'w-20 overflow-hidden border-2 border-dashed border-rule',
                scanning && 'receipt-scan-image-active',
              )}
            >
              <ReceiptTapToFullscreen
                receiptUrl={receipt.url}
                label={label}
                showHint={false}
                thumbnailClassName="block h-24 w-full border-0 object-cover object-top"
                actions={(close) => (
                  <div className="flex flex-col gap-3">
                    <p className="text-center text-[12px] text-ink-muted">
                      {imported
                        ? `${position}. Редовете от нея са добавени.`
                        : `${position}. Още не е разпозната.`}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          close()
                          onScan(receipt._id)
                        }}
                      >
                        <ScanLineIcon
                          className="size-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        {imported ? 'Разпознай отново' : 'Разпознай бележката'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          void onRemove(receipt._id, close).then((removed) => {
                            if (removed) refocusStrip()
                          })
                        }}
                      >
                        <Trash2Icon
                          className="size-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        Премахни снимката
                      </Button>
                    </div>
                  </div>
                )}
              />
            </div>
            {imported ? (
              <span
                aria-hidden
                className="pointer-events-none absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"
              >
                <CheckIcon className="size-3" strokeWidth={2.5} />
              </span>
            ) : null}
          </li>
        )
      })}
      {canAdd ? (
        <li className="shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={busy}
                className="flex h-[100px] w-20 flex-col items-center justify-center gap-1 border-2 border-dashed border-rule text-[11px] font-semibold text-ink-muted hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-stamp disabled:cursor-not-allowed disabled:opacity-45"
              >
                <PlusIcon className="size-5" strokeWidth={1.75} aria-hidden />
                Още бележка
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem className="min-h-11" onSelect={onTakePhoto}>
                <CameraIcon strokeWidth={1.75} aria-hidden />
                Снимай
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-h-11"
                onSelect={onPickFromGallery}
              >
                <ImageIcon strokeWidth={1.75} aria-hidden />
                От галерията
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ) : null}
    </ul>
  )
}
