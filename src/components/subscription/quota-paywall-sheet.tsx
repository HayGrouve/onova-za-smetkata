import { SparklesIcon } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { ICON } from '#/lib/app-icons.ts'

export interface QuotaPaywallSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: string
  onUpgrade: () => void
}

export function QuotaPaywallSheet({
  open,
  onOpenChange,
  message,
  onUpgrade,
}: QuotaPaywallSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-lg rounded-t-xl"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <SparklesIcon className={ICON.section} aria-hidden />
            Надградете до Pro
          </SheetTitle>
        </SheetHeader>

        <p className="px-4 text-sm text-muted-foreground">{message}</p>

        <SheetFooter className="border-t">
          <Button
            type="button"
            className="h-11 w-full"
            onClick={() => {
              onUpgrade()
              onOpenChange(false)
            }}
          >
            Виж планове и абонамент
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
