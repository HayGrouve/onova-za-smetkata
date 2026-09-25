import { useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { joinLabels } from '#/lib/participant-labels.ts'
import type { ClaimJoinOption, UnitRef } from '../../../shared/claim-groups.ts'

export interface JoinUnitSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  options: ClaimJoinOption[]
  participantLabels: Record<string, string>
  onJoin: (unit: UnitRef) => Promise<boolean>
}

/** Explicit „we shared it“: join a Unit someone else already has. */
export function JoinUnitSheet({
  open,
  onOpenChange,
  itemName,
  options,
  participantLabels,
  onJoin,
}: JoinUnitSheetProps) {
  const [joiningKey, setJoiningKey] = useState<string | null>(null)

  async function handleJoin(option: ClaimJoinOption) {
    const key = option.memberIds.join(',')
    setJoiningKey(key)
    const ok = await onJoin(option.units[0])
    setJoiningKey(null)
    if (ok) onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85dvh] max-w-lg rounded-t-xl"
        data-testid="join-unit-sheet"
      >
        <SheetHeader>
          <SheetTitle>Споделихте ли „{itemName}“?</SheetTitle>
          <SheetDescription>
            Изберете с кого сте я разделили. Цената се разделя поравно между
            вас. Ако сте имали отделна бройка, не се присъединявайте — кажете на
            домакина.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-4 pb-4">
          {options.map((option) => {
            const key = option.memberIds.join(',')
            const names = joinLabels(
              option.memberIds.map((id) => participantLabels[id] ?? 'Участник'),
            )
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    С {names}
                    {option.units.length > 1 ? (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        · {option.units.length} бр.
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Вие ще платите {formatEur(option.joinedShareCents)} за една
                    бройка
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 shrink-0"
                  disabled={joiningKey !== null}
                  onClick={() => void handleJoin(option)}
                >
                  Разделихме я
                </Button>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
