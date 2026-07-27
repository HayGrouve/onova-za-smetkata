import { useEffect, useState } from 'react'
import { useMutation } from 'convex/react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { usePaymentSettings } from '#/components/bills/payment-settings-provider.tsx'
import {
  clearLegacyPaymentSettings,
  loadLegacyPaymentSettings,
} from '#/lib/payment-settings.ts'
import {
  formatPaymentSettingsErrors,
  parsePaymentSettingsInput,
} from '#/lib/payment-settings-schema.ts'
import { HOST_ONBOARDING_PAYMENT_CHECKPOINT } from '../../../shared/host-onboarding-messages.ts'
import { api } from '../../../convex/_generated/api'

export interface PaymentCheckpointSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onShareWithoutPayment: () => void
  onSavedAndShare: () => void
}

export function PaymentCheckpointSheet({
  open,
  onOpenChange,
  onShareWithoutPayment,
  onSavedAndShare,
}: PaymentCheckpointSheetProps) {
  const [showForm, setShowForm] = useState(false)
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
    if (!open) {
      setShowForm(false)
      return
    }
    if (settings === undefined) return

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
      return
    }

    setRevolutUsername('')
    setIban('')
  }, [open, settings])

  async function handleSaveAndShare() {
    const parsed = parsePaymentSettingsInput({ revolutUsername, iban })
    if (!parsed.success) {
      setFieldErrors(formatPaymentSettingsErrors(parsed.error))
      return
    }

    setSaving(true)
    try {
      await saveSettings(parsed.data)
      clearLegacyPaymentSettings()
      onSavedAndShare()
    } catch {
      toast.error('Неуспешно запазване')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        {!showForm ? (
          <>
            <SheetHeader>
              <SheetTitle>
                {HOST_ONBOARDING_PAYMENT_CHECKPOINT.title}
              </SheetTitle>
              <SheetDescription>
                {HOST_ONBOARDING_PAYMENT_CHECKPOINT.body}
              </SheetDescription>
            </SheetHeader>
            <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
              <Button className="h-11 w-full" onClick={() => setShowForm(true)}>
                {HOST_ONBOARDING_PAYMENT_CHECKPOINT.setupPrimary}
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full"
                onClick={onShareWithoutPayment}
              >
                {HOST_ONBOARDING_PAYMENT_CHECKPOINT.shareWithoutPayment}
              </Button>
            </SheetFooter>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>
                {HOST_ONBOARDING_PAYMENT_CHECKPOINT.formTitle}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="checkpoint-revolut">
                  Revolut потребителско име
                </Label>
                <Input
                  id="checkpoint-revolut"
                  value={revolutUsername}
                  onChange={(event) => setRevolutUsername(event.target.value)}
                  className="h-11"
                />
                {fieldErrors.revolutUsername ? (
                  <p className="text-sm text-destructive">
                    {fieldErrors.revolutUsername}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="checkpoint-iban">IBAN</Label>
                <Input
                  id="checkpoint-iban"
                  value={iban}
                  onChange={(event) => setIban(event.target.value)}
                  className="h-11"
                />
                {fieldErrors.iban ? (
                  <p className="text-sm text-destructive">{fieldErrors.iban}</p>
                ) : null}
              </div>
            </div>
            <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
              <Button
                className="h-11 w-full"
                disabled={saving}
                onClick={() => void handleSaveAndShare()}
              >
                {saving
                  ? 'Запазване...'
                  : HOST_ONBOARDING_PAYMENT_CHECKPOINT.saveAndShare}
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full"
                onClick={() => setShowForm(false)}
              >
                {HOST_ONBOARDING_PAYMENT_CHECKPOINT.back}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
