import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { formatCopyAmount } from '#/lib/bill-share.ts'
import {
  buildRevolutUrl,
  loadPaymentSettings,
} from '#/lib/payment-settings.ts'

export interface ParticipantPayActionsProps {
  remainingCents: number
  label: string
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
}: ParticipantPayActionsProps) {
  if (remainingCents <= 0) return null

  const settings = loadPaymentSettings()
  const revolutUsername = settings.revolutUsername?.trim()
  const iban = settings.iban?.trim()

  async function handleCopy() {
    await copyAmount(remainingCents)
  }

  async function handleRevolut() {
    if (!revolutUsername) return
    const copied = await copyAmount(remainingCents, { silent: true })
    if (!copied) return
    window.open(buildRevolutUrl(revolutUsername, remainingCents))
    toast.success('Отворен Revolut')
  }

  async function handleIban() {
    if (!iban) return
    try {
      await navigator.clipboard.writeText(iban)
      toast.success('IBAN копиран')
    } catch {
      toast.error('Неуспешно копиране')
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={handleCopy}>
        Копирай
      </Button>
      {revolutUsername ? (
        <Button variant="outline" size="sm" onClick={handleRevolut}>
          Revolut
        </Button>
      ) : null}
      {iban ? (
        <Button variant="outline" size="sm" onClick={handleIban}>
          IBAN
        </Button>
      ) : null}
    </div>
  )
}
