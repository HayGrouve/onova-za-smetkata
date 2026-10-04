import { SparklesIcon } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { HostProPlanPicker } from '#/components/subscription/host-pro-plan-picker.tsx'
import { useHostProStatus } from '#/hooks/use-host-pro.ts'
import { ICON } from '#/lib/app-icons.ts'
import { focusContentInsteadOfField } from '#/lib/dialog-focus.ts'

export interface QuotaPaywallSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: string
}

export function QuotaPaywallSheet({
  open,
  onOpenChange,
  message,
}: QuotaPaywallSheetProps) {
  const hostPro = useHostProStatus()
  const canUpgrade = hostPro?.enabled === true

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-xl"
        onOpenAutoFocus={focusContentInsteadOfField}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SparklesIcon className={ICON.section} aria-hidden />
            Надградете до Pro
          </SheetTitle>
        </SheetHeader>

        <p className="px-4 text-sm text-muted-foreground">{message}</p>

        {canUpgrade ? <HostProPlanPicker className="px-4" /> : null}

        <SheetFooter className="border-t">
          <Button
            type="button"
            variant={canUpgrade ? 'outline' : 'default'}
            className="h-11 w-full"
            onClick={() => onOpenChange(false)}
          >
            Затвори
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
