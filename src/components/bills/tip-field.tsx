import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '#/components/ui/button.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { parseTipInputToCents } from '#/lib/bill-metadata-schema.ts'
import {
  readTipPreference,
  writeTipPreference,
  type TipPercent,
} from '#/lib/tip-preferences-storage.ts'
import {
  formatEurInputValue,
  TIP_PRESETS,
  tipCentsFromPercent,
} from '../../../shared/tip-calculations.ts'
import { cn } from '#/lib/utils.ts'

export interface TipFieldProps {
  itemsSubtotalCents: number
  value: string
  onValueChange: (value: string) => void
  onValidCents: (cents: number) => void
  error?: string
  onClearError?: () => void
}

export function TipField({
  itemsSubtotalCents,
  value,
  onValueChange,
  onValidCents,
  error,
  onClearError,
}: TipFieldProps) {
  const [selectedPercent, setSelectedPercent] = useState<TipPercent | null>(
    null,
  )
  const appliedPreferenceRef = useRef(false)

  const chipsDisabled = itemsSubtotalCents <= 0

  const chipAmounts = useMemo(
    () =>
      TIP_PRESETS.map((percent) => ({
        percent,
        cents: tipCentsFromPercent(itemsSubtotalCents, percent),
      })),
    [itemsSubtotalCents],
  )

  useEffect(() => {
    if (appliedPreferenceRef.current) return
    if (itemsSubtotalCents <= 0) return

    appliedPreferenceRef.current = true
    const pref = readTipPreference()
    if (!pref) return
    if (pref.mode === 'percent') {
      setSelectedPercent(pref.percent)
      const cents = tipCentsFromPercent(itemsSubtotalCents, pref.percent)
      onValueChange(formatEurInputValue(cents))
      onValidCents(cents)
      return
    }
    setSelectedPercent(null)
    onValueChange(formatEurInputValue(pref.customCents))
    onValidCents(pref.customCents)
    // Apply stored preference once items exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional single run
  }, [itemsSubtotalCents])

  useEffect(() => {
    if (selectedPercent === null || itemsSubtotalCents <= 0) return
    const cents = tipCentsFromPercent(itemsSubtotalCents, selectedPercent)
    onValueChange(formatEurInputValue(cents))
    onValidCents(cents)
    // Recalculate when subtotal or active percent changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable parent handlers not required
  }, [itemsSubtotalCents, selectedPercent])

  function handlePercentSelect(percent: TipPercent) {
    setSelectedPercent(percent)
    writeTipPreference({ mode: 'percent', percent })
    const cents = tipCentsFromPercent(itemsSubtotalCents, percent)
    onValueChange(formatEurInputValue(cents))
    onClearError?.()
    onValidCents(cents)
  }

  function handleCustomChange(next: string) {
    setSelectedPercent(null)
    onValueChange(next)
    onClearError?.()
    const parsed = parseTipInputToCents(next)
    if (parsed.ok) {
      writeTipPreference({ mode: 'custom', customCents: parsed.cents })
      onValidCents(parsed.cents)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="tip">Бакшиш</Label>
      <div className="flex flex-wrap gap-2">
        {chipAmounts.map(({ percent, cents }) => (
          <Button
            key={percent}
            type="button"
            size="sm"
            variant={selectedPercent === percent ? 'default' : 'outline'}
            disabled={chipsDisabled}
            className={cn('h-9 px-3')}
            onClick={() => handlePercentSelect(percent)}
          >
            {percent}% · {formatEur(cents)}
          </Button>
        ))}
      </div>
      <Input
        id="tip"
        inputMode="decimal"
        value={value}
        onChange={(e) => handleCustomChange(e.target.value)}
        placeholder="0,00"
        className="h-11"
        aria-invalid={Boolean(error)}
      />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : chipsDisabled ? (
        <p className="text-xs text-muted-foreground">
          Добави артикули за да изчислиш бакшиш.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Разделя се поравно между всички участници.
        </p>
      )}
    </div>
  )
}
