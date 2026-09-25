import { cn } from '#/lib/utils.ts'

export interface SeatOption {
  id: string
  label: string
}

/** Pick whose items the claim actions mark (own seat or a Covered seat). */
export function SeatSwitcher({
  seats,
  activeSeatId,
  onChange,
}: {
  seats: SeatOption[]
  activeSeatId: string
  onChange: (seatId: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">Отбелязвате за:</p>
      <div
        className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1"
        role="tablist"
        aria-label="Отбелязвате за"
      >
        {seats.map((seat) => (
          <button
            key={seat.id}
            type="button"
            role="tab"
            aria-selected={seat.id === activeSeatId}
            className={cn(
              'h-11 min-w-24 flex-1 truncate rounded-md px-3 text-sm font-medium transition-colors',
              seat.id === activeSeatId
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground',
            )}
            onClick={() => onChange(seat.id)}
          >
            {seat.label}
          </button>
        ))}
      </div>
    </div>
  )
}
