import { ClockIcon } from 'lucide-react'
import { Card, CardContent } from '#/components/ui/card.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { ICON } from '#/lib/app-icons.ts'
import { COMBINED_PAYMENT_MESSAGES } from '../../../shared/combined-payment-messages'

export interface CombinedCoverNoticeProps {
  payerName: string
  coveredAmountCents: number
}

function formatCoveredGuestBanner(
  payerName: string,
  coveredAmountCents: number,
): string {
  return COMBINED_PAYMENT_MESSAGES.coveredGuestBanner
    .replace('{payer}', payerName)
    .replace('{amount}', formatEur(coveredAmountCents))
}

export function CombinedCoverNotice({
  payerName,
  coveredAmountCents,
}: CombinedCoverNoticeProps) {
  return (
    <Card className="border-accent-foreground/40 bg-accent/40">
      <CardContent className="flex flex-col gap-1.5 pt-4">
        <p className="flex items-start gap-2 text-sm">
          <ClockIcon
            className={`${ICON.section} mt-0.5 shrink-0 text-amber-600 dark:text-amber-500`}
            aria-hidden
          />
          <span>{formatCoveredGuestBanner(payerName, coveredAmountCents)}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {COMBINED_PAYMENT_MESSAGES.coveredGuestHint}
        </p>
      </CardContent>
    </Card>
  )
}
