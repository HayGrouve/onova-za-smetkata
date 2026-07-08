import { useQuery } from 'convex/react'
import { ReceiptIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Dialog, DialogClose, DialogContent } from '#/components/ui/dialog.tsx'
import { api } from '../../../convex/_generated/api'
import { ICON } from '#/lib/app-icons.ts'
import type { Id } from '../../../convex/_generated/dataModel'

export interface ReceiptPreviewCardProps {
  billId: Id<'bills'>
}

export function ReceiptPreviewCard({ billId }: ReceiptPreviewCardProps) {
  const [open, setOpen] = useState(false)
  const receiptUrl = useQuery(api.files.getReceiptUrl, { billId })

  if (receiptUrl === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptIcon className={ICON.section} aria-hidden />
            Касова бележка
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Зареждане...</p>
        </CardContent>
      </Card>
    )
  }

  if (!receiptUrl) return null

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptIcon className={ICON.section} aria-hidden />
            Касова бележка
          </CardTitle>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="tap-feedback w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-interactive="true"
          >
            <img
              src={receiptUrl}
              alt="Касова бележка"
              className="max-h-64 w-full rounded-md border object-contain"
            />
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Докоснете за по-голям преглед
          </p>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[90vh] max-w-[calc(100%-2rem)] overflow-y-auto border-0 bg-transparent p-0 shadow-none sm:max-w-lg"
        >
          <div className="relative">
            <img
              src={receiptUrl}
              alt="Касова бележка"
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
