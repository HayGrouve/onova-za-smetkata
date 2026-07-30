import { useQuery } from 'convex/react'
import { ReceiptIcon } from 'lucide-react'
import { ReceiptTapToFullscreen } from '#/components/bills/receipt-tap-to-fullscreen.tsx'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { api } from '../../../convex/_generated/api'
import { ICON } from '#/lib/app-icons.ts'
import type { Id } from '../../../convex/_generated/dataModel'

export interface ReceiptPreviewCardProps {
  billId: Id<'bills'>
}

export function ReceiptPreviewCard({ billId }: ReceiptPreviewCardProps) {
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ReceiptIcon className={ICON.section} aria-hidden />
          Касова бележка
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ReceiptTapToFullscreen
          receiptUrl={receiptUrl}
          thumbnailClassName="max-h-64"
        />
      </CardContent>
    </Card>
  )
}
