import { ImageOffIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '#/components/ui/dialog.tsx'
import { cn } from '#/lib/utils.ts'

export interface ReceiptTapToFullscreenProps {
  /** Null when the photo can no longer be loaded. */
  receiptUrl: string | null
  alt?: string
  /** Accessible name of the thumbnail button (e.g. „Бележка 2 от 3“). */
  label?: string
  /** Thumbnail image classes (object-fit, max height, etc.). */
  thumbnailClassName?: string
  showHint?: boolean
  className?: string
  /** Shown under the full-size photo; `close` shuts the viewer. */
  actions?: (close: () => void) => ReactNode
}

export function ReceiptTapToFullscreen({
  receiptUrl,
  alt = 'Касова бележка',
  label,
  thumbnailClassName,
  showHint = true,
  className,
  actions,
}: ReceiptTapToFullscreenProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={label}
          className="tap-feedback w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-interactive="true"
        >
          {receiptUrl ? (
            <img
              src={receiptUrl}
              alt={alt}
              className={cn(
                'w-full rounded-md border object-contain',
                thumbnailClassName,
              )}
            />
          ) : (
            <span
              className={cn(
                'w-full',
                thumbnailClassName,
                'grid place-items-center bg-paper-2 text-ink-muted',
              )}
            >
              <ImageOffIcon className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
          )}
        </button>
        {showHint ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Докосни за по-голям преглед
          </p>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          aria-describedby={undefined}
          className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          <DialogTitle className="sr-only">{label ?? alt}</DialogTitle>
          <div className="relative">
            {receiptUrl ? (
              <img
                src={receiptUrl}
                alt={alt}
                className={cn(
                  'w-full rounded-lg object-contain',
                  actions ? 'max-h-[70vh]' : 'max-h-[90vh]',
                )}
              />
            ) : (
              <p className="rounded-lg bg-background px-4 py-10 text-center text-sm text-ink-muted">
                Снимката не може да се зареди.
              </p>
            )}
            <DialogClose className="absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-md border border-white/20 bg-black/60 text-white shadow-md transition-colors hover:bg-black/75 focus:ring-2 focus:ring-white/50 focus:outline-none">
              <XIcon className="size-4 shrink-0" />
              <span className="sr-only">Затвори</span>
            </DialogClose>
          </div>
          {actions ? (
            <div className="rounded-lg bg-background p-3">
              {actions(() => setOpen(false))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
