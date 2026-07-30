import { XIcon } from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogClose, DialogContent } from '#/components/ui/dialog.tsx'
import { cn } from '#/lib/utils.ts'

export interface ReceiptTapToFullscreenProps {
  receiptUrl: string
  alt?: string
  /** Thumbnail image classes (object-fit, max height, etc.). */
  thumbnailClassName?: string
  showHint?: boolean
  className?: string
}

export function ReceiptTapToFullscreen({
  receiptUrl,
  alt = 'Касова бележка',
  thumbnailClassName,
  showHint = true,
  className,
}: ReceiptTapToFullscreenProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className={className}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap-feedback w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-interactive="true"
        >
          <img
            src={receiptUrl}
            alt={alt}
            className={cn(
              'w-full rounded-md border object-contain',
              thumbnailClassName,
            )}
          />
        </button>
        {showHint ? (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Докоснете за по-голям преглед
          </p>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          <div className="relative">
            <img
              src={receiptUrl}
              alt={alt}
              className="max-h-[90vh] w-full rounded-lg object-contain"
            />
            <DialogClose className="absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-md border border-white/20 bg-black/60 text-white shadow-md transition-colors hover:bg-black/75 focus:ring-2 focus:ring-white/50 focus:outline-none">
              <XIcon className="size-4 shrink-0" />
              <span className="sr-only">Затвори</span>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
