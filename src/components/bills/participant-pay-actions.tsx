import { useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { formatCopyAmount } from '#/lib/bill-share.ts'
import { buildRevolutUrl } from '#/lib/payment-settings.ts'
import { api } from '../../../convex/_generated/api'

export interface ParticipantPayActionsProps {
  remainingCents: number
  label: string
  onOpenSettings?: () => void
}

async function copyAmount(cents: number, options?: { silent?: boolean }): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(formatCopyAmount(cents))
    if (!options?.silent) {
      toast.success('Копирано')
    }
    return true
  } catch {
    toast.error('Неуспешно копиране')
    return false
  }
}

export async function copyRemainingAmount(cents: number): Promise<void> {
  await copyAmount(cents)
}

export function ParticipantPayActions({
  remainingCents,
  onOpenSettings,
}: ParticipantPayActionsProps) {
  const settings = useQuery(api.paymentSettings.get)

  if (remainingCents <= 0) return null

  const revolutUsername = settings?.revolutUsername?.trim()
  const iban = settings?.iban?.trim()

  async function handleCopy() {
    await copyAmount(remainingCents)
  }

  async function handleRevolut() {
    if (!revolutUsername) {
      onOpenSettings?.()
      return
    }
    const copied = await copyAmount(remainingCents, { silent: true })
    if (!copied) return
    window.open(buildRevolutUrl(revolutUsername, remainingCents))
    toast.success('Отворен Revolut')
  }

  async function handleIban() {
    if (!iban) {
      onOpenSettings?.()
      return
    }
    try {
      await navigator.clipboard.writeText(iban)
      toast.success('IBAN копиран')
    } catch {
      toast.error('Неуспешно копиране')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          Копирай
        </Button>
        <Button variant="outline" size="sm" onClick={handleRevolut}>
          Revolut
        </Button>
        <Button variant="outline" size="sm" onClick={handleIban}>
          IBAN
        </Button>
      </div>
      {!revolutUsername && !iban ? (
        <p className="text-xs text-muted-foreground">
          Добавете Revolut или IBAN в настройките за плащане.
        </p>
      ) : null}
    </div>
  )
}
