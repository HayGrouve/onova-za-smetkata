import { CheckIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { cn } from '#/lib/utils.ts'
import type { ParticipantInput } from '../../../shared/bill-calculations.ts'
import { splitUnitShareAmongAssignees } from '../../../shared/unit-share-allocation.ts'

export interface ShareCandidate {
  id: string
  label: string
}

export interface ShareUnitSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName: string
  unitPriceCents: number
  seatId: string
  participants: ParticipantInput[]
  candidates: ShareCandidate[]
  /** Co-members already on the Unit (edit mode). */
  initialSelectedIds?: string[]
  mode: 'new' | 'edit'
  onConfirm: (selectedIds: string[]) => Promise<boolean>
}

export function ShareUnitSheet({
  open,
  onOpenChange,
  itemName,
  unitPriceCents,
  seatId,
  participants,
  candidates,
  initialSelectedIds = [],
  mode,
  onConfirm,
}: ShareUnitSheetProps) {
  const [selected, setSelected] = useState<string[]>(initialSelectedIds)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setSelected(initialSelectedIds)
    // Reset only when the sheet opens; the list prop is rebuilt every render.
  }, [open])

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    )
  }

  async function confirm(ids: string[]) {
    setSaving(true)
    const ok = await onConfirm(ids)
    setSaving(false)
    if (ok) onOpenChange(false)
  }

  const memberCount = selected.length + 1
  const myShareCents =
    splitUnitShareAmongAssignees(
      unitPriceCents,
      [seatId, ...selected],
      participants,
    ).find((portion) => portion.id === seatId)?.cents ?? unitPriceCents

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85dvh] max-w-lg rounded-t-xl"
        data-testid="share-unit-sheet"
      >
        <SheetHeader>
          <SheetTitle>Сподели „{itemName}“</SheetTitle>
          <SheetDescription>
            {mode === 'new'
              ? 'С кого разделихте една бройка? Цената се разделя поравно и влиза в техния дял веднага.'
              : 'Кой дели тази бройка с вас? Промяната влиза в дяловете веднага.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-4">
          {candidates.map((candidate) => {
            const isSelected = selected.includes(candidate.id)
            return (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(candidate.id)}
                className={cn(
                  'tap-feedback flex min-h-11 items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm',
                  isSelected
                    ? 'border-primary/50 bg-primary/10 font-medium'
                    : 'bg-background',
                )}
              >
                {candidate.label}
                <span
                  aria-hidden
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full border',
                    isSelected &&
                      'border-primary bg-primary text-primary-foreground',
                  )}
                >
                  {isSelected ? <CheckIcon className="size-3.5" /> : null}
                </span>
              </button>
            )
          })}
        </div>

        <SheetFooter className="gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {selected.length === 0
              ? `Само вие: ${formatEur(unitPriceCents)}`
              : `Разделено на ${memberCount}: вие плащате ${formatEur(myShareCents)}`}
          </p>
          <Button
            type="button"
            className="h-11"
            disabled={saving || (mode === 'new' && selected.length === 0)}
            onClick={() => void confirm(selected)}
          >
            {mode === 'new' ? 'Сподели' : 'Запази'}
          </Button>
          {mode === 'edit' && initialSelectedIds.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11"
              disabled={saving}
              onClick={() => void confirm([])}
            >
              Спри споделянето
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
