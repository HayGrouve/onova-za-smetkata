import { ShareIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import type { ParticipantTotals } from '#/lib/bill-calculations.ts'
import { formatBillShareText, shareOrCopyText } from '#/lib/bill-share.ts'
import { cn } from '#/lib/utils.ts'

export interface ShareBillParticipant {
  label: string
  sortOrder: number
  totals: ParticipantTotals
}

export interface ShareBillButtonProps {
  restaurantName: string
  date: Date
  billTotalCents: number
  participants: ShareBillParticipant[]
  className?: string
}

export function ShareBillButton({
  restaurantName,
  date,
  billTotalCents,
  participants,
  className,
}: ShareBillButtonProps) {
  async function handleShare() {
    const sorted = [...participants].sort((a, b) => a.sortOrder - b.sortOrder)
    const text = formatBillShareText({
      restaurantName,
      date,
      billTotalCents,
      participants: sorted.map((p) => ({
        label: p.label,
        owedCents: p.totals.owedCents,
        status: p.totals.status,
      })),
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
