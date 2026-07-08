import { useConvexAuth } from '@convex-dev/auth/react'
import { useQuery } from 'convex/react'
import { CogIcon, WalletIcon } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import {
  getPaymentSettingsStatus,
  type PaymentSettingsStatus,
} from '#/lib/payment-settings.ts'
import { ICON } from '#/lib/app-icons.ts'
import { cn } from '#/lib/utils.ts'
import { api } from '../../../convex/_generated/api'

export interface PaymentSettingsOpenButtonProps {
  onClick: () => void
  className?: string
}

export function usePaymentSettingsStatus(): PaymentSettingsStatus {
  const { isAuthenticated } = useConvexAuth()
  const settings = useQuery(
    api.paymentSettings.get,
    isAuthenticated ? {} : 'skip',
  )
  return getPaymentSettingsStatus(settings)
}

export function usePaymentSettingsConfigured(): boolean {
  return usePaymentSettingsStatus() === 'configured'
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
