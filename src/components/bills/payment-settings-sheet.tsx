import { useEffect, useState } from 'react'
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
import {
  loadPaymentSettings,
  savePaymentSettings,
} from '#/lib/payment-settings.ts'

export interface PaymentSettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PaymentSettingsSheet({
  open,
  onOpenChange,
}: PaymentSettingsSheetProps) {
  const [revolutUsername, setRevolutUsername] = useState('')
  const [iban, setIban] = useState('')

  useEffect(() => {
    if (!open) return
    const settings = loadPaymentSettings()
    setRevolutUsername(settings.revolutUsername ?? '')
    setIban(settings.iban ?? '')
  }, [open])

  function handleSave() {
    savePaymentSettings({
      revolutUsername: revolutUsername.trim() || undefined,
      iban: iban.trim() || undefined,
    })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-xl">
        <SheetHeader>
          <SheetTitle>Настройки за плащане</SheetTitle>
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
            <Input
              id="iban"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              placeholder="BG00XXXX00000000000000"
              className="h-11"
              autoComplete="off"
            />
          </div>
        </div>

        <SheetFooter className="border-t">
          <Button type="button" className="h-11 w-full" onClick={handleSave}>
            Запази
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
