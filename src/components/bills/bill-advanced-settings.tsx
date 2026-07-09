import { ChevronDownIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '#/components/ui/collapsible.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { ICON } from '#/lib/app-icons.ts'
import {
  readBillAdvancedSettingsOpen,
  writeBillAdvancedSettingsOpen,
} from '#/lib/bill-advanced-settings-storage.ts'
import { cn } from '#/lib/utils.ts'

export function BillAdvancedSettings({
  note,
  date,
  noteError,
  dateError,
  onNoteChange,
  onDateChange,
}: {
  note: string
  date: string
  noteError?: string
  dateError?: string
  onNoteChange: (value: string) => void
  onDateChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(readBillAdvancedSettingsOpen())
  }, [])

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    writeBillAdvancedSettingsOpen(nextOpen)
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger
        className={cn(
          'tap-feedback flex h-11 w-full items-center justify-between gap-2 rounded-md border px-3 text-sm font-medium',
          'text-muted-foreground hover:bg-muted/50',
        )}
        aria-expanded={open}
      >
        <span>Разширени настройки</span>
        <ChevronDownIcon
          className={cn(
            ICON.button,
            'shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        id="bill-advanced-settings"
        className="flex flex-col gap-3 pt-3 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note">Бележка</Label>
          <Input
            id="note"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Незадължителна бележка"
            className="h-11"
            aria-invalid={Boolean(noteError)}
          />
          {noteError ? (
            <p className="text-xs text-destructive">{noteError}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="date">Дата</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="h-11"
            aria-invalid={Boolean(dateError)}
          />
          {dateError ? (
            <p className="text-xs text-destructive">{dateError}</p>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
