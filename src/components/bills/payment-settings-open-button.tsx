import { CogIcon, WalletIcon } from 'lucide-react'
import { usePaymentSettings } from '#/components/bills/payment-settings-provider.tsx'
import { Button } from '#/components/ui/button.tsx'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'

export interface PaymentSettingsOpenButtonProps {
  onClick: () => void
  className?: string
}

export function usePaymentSettingsStatus() {
  return usePaymentSettings().status
}

export function usePaymentSettingsConfigured(): boolean {
  return usePaymentSettings().status === 'configured'
}

export function PaymentSettingsOpenButton({
  onClick,
  className,
}: PaymentSettingsOpenButtonProps) {
  const status = usePaymentSettingsStatus()

  if (status === 'loading') return null

  if (status === 'configured') {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('h-11 w-11 shrink-0', className)}
        aria-label="Настройки за плащане"
        onClick={onClick}
      >
        <CogIcon className="size-4" />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      className={cn('h-11 w-full', className)}
      onClick={onClick}
    >
      <WalletIcon className={ICON.button} aria-hidden />
      Настройки за плащане (Revolut / IBAN)
    </Button>
  )
}
