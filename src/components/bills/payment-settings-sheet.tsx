import { CopyIcon, SaveIcon, WalletIcon } from 'lucide-react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { ICON } from '#/lib/app-icons.ts'
import {
  clearLegacyPaymentSettings,
  loadLegacyPaymentSettings,
} from '#/lib/payment-settings.ts'
import { api } from '../../../convex/_generated/api'

export interface PaymentSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentSettingsSheet({
  open,
  onOpenChange,
}: PaymentSettingsSheetProps) {
  const { isAuthenticated } = useConvexAuth()
  const settings = useQuery(
    api.paymentSettings.get,
    isAuthenticated ? {} : 'skip',
  )
  const saveSettings = useMutation(api.paymentSettings.save)
  const [revolutUsername, setRevolutUsername] = useState('')
  const [iban, setIban] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || settings === undefined) return

    if (settings.revolutUsername || settings.iban) {
      setRevolutUsername(settings.revolutUsername ?? '')
      setIban(settings.iban ?? '')
      return
    }

    const legacy = loadLegacyPaymentSettings()
    if (legacy.revolutUsername || legacy.iban) {
      setRevolutUsername(legacy.revolutUsername ?? '')
      setIban(legacy.iban ?? '')
      void saveSettings(legacy).then(() => clearLegacyPaymentSettings())
      return
    }

    setRevolutUsername('')
    setIban('')
  }, [open, settings, saveSettings])

  async function handleSave() {
    setSaving(true)
    try {
      await saveSettings({
        revolutUsername: revolutUsername.trim() || undefined,
        iban: iban.trim() || undefined,
      })
      clearLegacyPaymentSettings()
      toast.success('Настройките са запазени')
      onOpenChange(false)
    } catch {
      toast.error('Неуспешно запазване')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <WalletIcon className={ICON.section} aria-hidden />
            Настройки за плащане
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="revolut-username">Revolut потребителско име</Label>
            <Input
              id="revolut-username"
              value={revolutUsername}
              onChange={(e) => setRevolutUsername(e.target.value)}
              placeholder="username"
              className="h-11"
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="iban">IBAN</Label>
            <div className="flex gap-2">
              <Input
                id="iban"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="BG00XXXX00000000000000"
                className="h-11 min-w-0 flex-1"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0"
                disabled={!iban.trim()}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(iban.trim())
                    toast.success('IBAN копиран')
                  } catch {
                    toast.error('Неуспешно копиране')
                  }
                }}
              >
                <CopyIcon className={ICON.button} aria-hidden />
                Копирай
              </Button>
            </div>
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button
            type="button"
            className="h-11 w-full"
            onClick={handleSave}
            disabled={saving || settings === undefined}
          >
            <SaveIcon className={ICON.button} aria-hidden />
            Запази
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
