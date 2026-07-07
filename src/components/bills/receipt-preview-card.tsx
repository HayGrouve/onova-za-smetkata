import { useQuery } from 'convex/react'
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import {
  Dialog,
  DialogContent,
} from '#/components/ui/dialog.tsx'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export interface ReceiptPreviewCardProps {
  storageId: Id<'_storage'>
}

export function ReceiptPreviewCard({ storageId }: ReceiptPreviewCardProps) {
  const [open, setOpen] = useState(false)
  const receiptUrl = useQuery(api.files.getUrl, { storageId })

  if (receiptUrl === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Касова бележка</CardTitle>
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
          <CardTitle>Касова бележка</CardTitle>
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
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto p-2">
          <img
            src={receiptUrl}
            alt="Касова бележка"
            className="h-auto w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
