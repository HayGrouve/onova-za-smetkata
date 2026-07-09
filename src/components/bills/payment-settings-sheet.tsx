import { CopyIcon, SaveIcon, WalletIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { usePaymentSettings } from '#/components/bills/payment-settings-provider.tsx'
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
import {
  formatPaymentSettingsErrors,
  parsePaymentSettingsInput,
} from '#/lib/payment-settings-schema.ts'
import { api } from '../../../convex/_generated/api'

export interface PaymentSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentSettingsSheet({
  open,
  onOpenChange,
}: PaymentSettingsSheetProps) {
  const { settings } = usePaymentSettings()
  const saveSettings = useMutation(api.paymentSettings.save)
  const [revolutUsername, setRevolutUsername] = useState('')
  const [iban, setIban] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{
    revolutUsername?: string
    iban?: string
  }>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || settings === undefined) return

    setFieldErrors({})

    if (settings.revolutUsername || settings.iban) {
      setRevolutUsername(settings.revolutUsername ?? '')
      setIban(settings.iban ?? '')
      return
    }

    const legacy = loadLegacyPaymentSettings()
    if (legacy.revolutUsername || legacy.iban) {
      setRevolutUsername(legacy.revolutUsername ?? '')
      setIban(legacy.iban ?? '')
      const parsedLegacy = parsePaymentSettingsInput({
        revolutUsername: legacy.revolutUsername ?? '',
        iban: legacy.iban ?? '',
      })
      if (parsedLegacy.success) {
        void saveSettings(parsedLegacy.data).then(() =>
          clearLegacyPaymentSettings(),
        )
      }
      return
    }

    setRevolutUsername('')
    setIban('')
  }, [open, settings, saveSettings])

  async function handleSave() {
    const parsed = parsePaymentSettingsInput({ revolutUsername, iban })
    if (!parsed.success) {
      setFieldErrors(formatPaymentSettingsErrors(parsed.error))
      return
    }

    setFieldErrors({})
    setSaving(true)
    try {
      await saveSettings(parsed.data)
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
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
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
              onChange={(e) => {
                setRevolutUsername(e.target.value)
                if (fieldErrors.revolutUsername) {
                  setFieldErrors((current) => ({
                    ...current,
                    revolutUsername: undefined,
                  }))
                }
              }}
              onBlur={() => {
                const trimmed = revolutUsername.trim()
                if (trimmed.startsWith('@')) {
                  setRevolutUsername(trimmed.replace(/^@+/, ''))
                }
              }}
              placeholder="username"
              className="h-11"
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.revolutUsername)}
            />
            {fieldErrors.revolutUsername ? (
              <p className="text-xs text-destructive">
                {fieldErrors.revolutUsername}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="iban">IBAN</Label>
            <div className="flex gap-2">
              <Input
                id="iban"
                value={iban}
                onChange={(e) => {
                  setIban(e.target.value)
                  if (fieldErrors.iban) {
                    setFieldErrors((current) => ({
                      ...current,
                      iban: undefined,
                    }))
                  }
                }}
                placeholder="BG00XXXX00000000000000"
                className="h-11 min-w-0 flex-1"
                autoComplete="off"
                aria-invalid={Boolean(fieldErrors.iban)}
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
            {fieldErrors.iban ? (
              <p className="text-xs text-destructive">{fieldErrors.iban}</p>
            ) : null}
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
