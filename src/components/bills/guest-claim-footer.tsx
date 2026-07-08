import { SendIcon } from 'lucide-react'
import { useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { formatCopyAmount } from '#/lib/bill-share.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { buildRevolutUrl } from '#/lib/payment-settings.ts'
import { copyToClipboard } from '#/lib/copy-to-clipboard.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

export interface GuestClaimFooterProps {
  billId: Id<'bills'>
  owedCents: number
  remainingCents: number
}

export function GuestClaimFooter({
  billId,
  owedCents,
  remainingCents,
}: GuestClaimFooterProps) {
  const settings = useQuery(api.paymentSettings.getForGuest, { billId })
  const revolutUsername = settings?.revolutUsername?.trim()

  async function handleRevolut() {
    if (!revolutUsername || remainingCents <= 0) return
    void copyToClipboard(formatCopyAmount(remainingCents))
    window.open(buildRevolutUrl(revolutUsername, remainingCents))
    toast.success('Отворен Revolut')
  }

  return (
    <>
      <div aria-hidden className="sticky-totals-bar-spacer" />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Вашият дял</p>
              <p
                key={owedCents}
                className="guest-total-pulse text-lg font-semibold tabular-nums"
              >
                {formatEur(owedCents)}
              </p>
            </div>
            <Button
              type="button"
              className="h-11"
              disabled={!revolutUsername || remainingCents <= 0}
              onClick={handleRevolut}
            >
              <SendIcon className={ICON.button} aria-hidden />
              Revolut
            </Button>
          </div>
          {!revolutUsername ? (
            <p className="text-xs text-muted-foreground">
              Попитайте домакина за Revolut.
            </p>
          ) : remainingCents <= 0 ? (
            <p className="text-xs text-muted-foreground">
              Няма оставащо за плащане.
            </p>
          ) : null}
        </div>
      </div>
    </>
  )
}
