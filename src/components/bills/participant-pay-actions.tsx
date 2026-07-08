import { SendIcon } from 'lucide-react'
import { toast } from 'sonner'
import { usePaymentSettings } from '#/components/bills/payment-settings-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { formatCopyAmount } from '#/lib/bill-share.ts'
import { buildRevolutUrl } from '#/lib/payment-settings.ts'
import { copyToClipboard } from '#/lib/copy-to-clipboard.ts'

export interface ParticipantPayActionsProps {
  remainingCents: number
  label: string
  onOpenSettings?: () => void
}

async function copyAmount(
  cents: number,
  options?: { silent?: boolean },
): Promise<boolean> {
  const copied = await copyToClipboard(formatCopyAmount(cents))
  if (copied && !options?.silent) {
    toast.success('Копирано')
  } else if (!copied && !options?.silent) {
    toast.error('Неуспешно копиране')
  }
  return copied
}

export async function copyRemainingAmount(cents: number): Promise<void> {
  await copyAmount(cents)
}

export function ParticipantPayActions({
  remainingCents,
  onOpenSettings,
}: ParticipantPayActionsProps) {
  const { settings } = usePaymentSettings()

  if (remainingCents <= 0) return null

  const revolutUsername = settings?.revolutUsername?.trim()

  async function handleRevolut() {
    if (!revolutUsername) {
      onOpenSettings?.()
      return
    }
    void copyAmount(remainingCents, { silent: true })
    window.open(buildRevolutUrl(revolutUsername, remainingCents))
    toast.success('Отворен Revolut')
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={handleRevolut}
      >
        <SendIcon className={ICON.button} aria-hidden />
        Revolut
      </Button>
      {!revolutUsername ? (
        <p className="text-xs text-muted-foreground">
          Добавете Revolut в настройките за плащане.
        </p>
      ) : null}
    </div>
  )
}
