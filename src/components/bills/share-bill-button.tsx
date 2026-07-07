import { ShareIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import type {
  BillBreakdownInput,
  ParticipantTotals,
} from '#/lib/bill-calculations.ts'
import { formatBillShareText, shareOrCopyText } from '#/lib/bill-share.ts'
import { cn } from '#/lib/utils.ts'

export interface ShareBillParticipant {
  id: string
  label: string
  sortOrder: number
  totals: ParticipantTotals
}

export interface ShareBillButtonProps {
  restaurantName: string
  date: Date
  note?: string
  billTotalCents: number
  breakdown: BillBreakdownInput
  participants: ShareBillParticipant[]
  className?: string
}

export function ShareBillButton({
  restaurantName,
  date,
  note,
  billTotalCents,
  breakdown,
  participants,
  className,
}: ShareBillButtonProps) {
  async function handleShare() {
    const text = formatBillShareText({
      restaurantName,
      date,
      note,
      billTotalCents,
      breakdown,
      participants,
    })

    try {
      const result = await shareOrCopyText(
        text,
        restaurantName.trim() || 'Сметка',
      )
      toast.success(result === 'shared' ? 'Споделено' : 'Копирано')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      toast.error('Неуспешно копиране')
    }
  }

  return (
    <Button
      type="button"
      className={cn('h-11 w-full', className)}
      onClick={handleShare}
    >
      <ShareIcon className="size-4" />
      Сподели сметка
    </Button>
  )
}
