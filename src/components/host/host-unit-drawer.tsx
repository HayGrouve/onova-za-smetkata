import { useMutation } from 'convex/react'
import { useState } from 'react'
import { toast } from 'sonner'
import { LinePanel } from '#/components/receipt/line-drawer.tsx'
import { SeatAvatar, useSeats } from '#/components/receipt/seats.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { getConvexErrorMessage } from '#/lib/guest-participant-session.ts'
import { cn } from '#/lib/utils.ts'
import { unitKey } from '../../../shared/claim-groups.ts'
import type { ClaimGroup, UnitRef } from '../../../shared/claim-groups.ts'
import { splitUnitShareAmongAssignees } from '../../../shared/unit-share-allocation.ts'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'

/**
 * Host: who had each Unit of a line. One person takes the whole Unit;
 * several share its price evenly.
 */
export function HostUnitDrawer({
  group,
  membersOf,
  participants,
  onClose,
}: {
  group: ClaimGroup
  membersOf: (unit: UnitRef) => string[]
  participants: Array<{ id: string; sortOrder: number }>
  onClose: () => void
}) {
  const seats = useSeats()
  const joinUnit = useMutation(api.assignments.joinUnit)
  const leaveUnit = useMutation(api.assignments.leaveUnit)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  async function toggle(unit: UnitRef, seatId: string, on: boolean) {
    const key = `${unitKey(unit)}:${seatId}`
    setBusyKey(key)
    const args = {
      itemId: unit.itemId as Id<'items'>,
      unitIndex: unit.unitIndex,
      participantId: seatId as Id<'participants'>,
    }
    try {
      await (on ? leaveUnit(args) : joinUnit(args))
    } catch (error) {
      toast.error(getConvexErrorMessage(error))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <LinePanel title="Кой какво от този ред" onClose={onClose}>
      <p className="mb-2 text-[11px] leading-snug text-ink-muted">
        Отбележете кой е ял от всяка бройка. Двама или повече делят цената
        поравно.
      </p>
      <ul className="space-y-2">
        {group.units.map((unit, index) => {
          const ids = membersOf(unit)
          const each =
            ids.length > 1
              ? (splitUnitShareAmongAssignees(
                  group.unitPriceCents,
                  ids,
                  participants,
                )[0]?.cents ?? 0)
              : group.unitPriceCents
          return (
            <li key={unitKey(unit)} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] leading-tight">
                Бр. {index + 1}
                <span className="block text-ink-muted">
                  {ids.length === 0
                    ? 'свободна'
                    : ids.length === 1
                      ? formatEur(each)
                      : `по ${formatEur(each)}`}
                </span>
              </span>
              <div className="scroll-x-quiet flex min-w-0 flex-1 gap-1 overflow-x-auto">
                {seats.map((seat) => {
                  const on = ids.includes(seat.id)
                  const key = `${unitKey(unit)}:${seat.id}`
                  return (
                    <button
                      key={seat.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${seat.label}, бройка ${index + 1}`}
                      disabled={busyKey === key}
                      onClick={() => void toggle(unit, seat.id, on)}
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-full transition-opacity',
                        !on && 'opacity-35 grayscale hover:opacity-70',
                      )}
                    >
                      <SeatAvatar
                        seat={seat}
                        size="sm"
                        className={cn(
                          on &&
                            'ring-2 ring-ink ring-offset-2 ring-offset-paper-2',
                        )}
                      />
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
    </LinePanel>
  )
}
