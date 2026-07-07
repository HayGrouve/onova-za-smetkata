import { useMutation } from 'convex/react'
import { CheckIcon, MinusIcon, PlusIcon } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { formatEur } from '#/lib/format-currency.ts'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'

export interface GuestItemRowProps {
  item: Doc<'items'>
  participantId: Id<'participants'>
  itemAssignments: Doc<'itemAssignments'>[]
  readOnly: boolean
}

export function GuestItemRow({
  item,
  participantId,
  itemAssignments,
  readOnly,
}: GuestItemRowProps) {
  const toggleAssignment = useMutation(api.assignments.toggle)
  const setUnits = useMutation(api.assignments.setUnits)

  const myAssignment = itemAssignments.find(
    (assignment) => assignment.participantId === participantId,
  )
  const myUnits = myAssignment?.units ?? 0
  const assignedUnitsTotal = itemAssignments.reduce(
    (sum, assignment) => sum + (assignment.units ?? 0),
    0,
  )
  const otherAssigneeCount = itemAssignments.filter(
    (assignment) =>
      assignment.participantId !== participantId && (assignment.units ?? 0) > 0,
  ).length
  const lineTotalCents = item.unitPriceCents * item.quantity

  const cardClassName = (selected: boolean) =>
    cn(
      'guest-claim-card tap-feedback flex flex-col gap-1 rounded-lg border p-4 text-left',
      selected
        ? 'guest-claim-card--selected border-primary/50 bg-primary/10 dark:border-primary/40 dark:bg-primary/15'
        : 'border-border bg-card',
      readOnly && 'opacity-80',
    )

  if (item.quantity === 1) {
    const isClaimed = itemAssignments.some(
      (assignment) => assignment.participantId === participantId,
    )
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() =>
          void toggleAssignment({ itemId: item._id, participantId })
        }
        className={cardClassName(isClaimed)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatEur(item.unitPriceCents)} × {item.quantity}
            </p>
          </div>
          <p className="font-medium tabular-nums">{formatEur(lineTotalCents)}</p>
        </div>
        {otherAssigneeCount > 0 && (
          <p className="text-xs text-muted-foreground">
            +{otherAssigneeCount} други
          </p>
        )}
        {!readOnly && (
          <p
            key={isClaimed ? 'claimed' : 'open'}
            className={cn(
              'guest-status-in flex items-center gap-1 text-xs font-medium',
              isClaimed ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {isClaimed ? (
              <>
                <CheckIcon className="size-3.5" aria-hidden />
                Отбелязано
              </>
            ) : (
              'Докоснете, за да отбележите'
            )}
          </p>
        )}
      </button>
    )
  }

  const remainingUnits = Math.max(0, item.quantity - assignedUnitsTotal + myUnits)
  const hasClaimedUnits = myUnits > 0

  return (
    <div className={cn(cardClassName(hasClaimedUnits), 'gap-2')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatEur(item.unitPriceCents)} × {item.quantity}
          </p>
        </div>
        <p className="font-medium tabular-nums">{formatEur(lineTotalCents)}</p>
      </div>
      {otherAssigneeCount > 0 && (
        <p className="text-xs text-muted-foreground">
          +{otherAssigneeCount} други · {assignedUnitsTotal}/{item.quantity}{' '}
          разпределени
        </p>
      )}
      {!readOnly && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/40 px-3 py-2.5 dark:border-input dark:bg-input/40">
          <span className="text-sm font-medium text-foreground">Ваши бройки</span>
          <div className="flex items-center gap-1 rounded-full border border-primary/50 bg-background/80 pl-1 pr-1 dark:border-primary/40 dark:bg-background/60">
            <button
              type="button"
              aria-label="Намали"
              disabled={myUnits <= 0}
              onClick={() =>
                void setUnits({
                  itemId: item._id,
                  participantId,
                  units: myUnits - 1,
                })
              }
              className="tap-feedback flex size-8 items-center justify-center rounded-full text-foreground hover:bg-foreground/10 disabled:opacity-40"
            >
              <MinusIcon className="size-4" />
            </button>
            <span
              key={myUnits}
              className="guest-count-pop min-w-8 text-center text-sm font-semibold tabular-nums text-foreground"
            >
              {myUnits}
            </span>
            <button
              type="button"
              aria-label="Увеличи"
              disabled={myUnits >= remainingUnits}
              onClick={() =>
                void setUnits({
                  itemId: item._id,
                  participantId,
                  units: myUnits + 1,
                })
              }
              className="tap-feedback flex size-8 items-center justify-center rounded-full text-foreground hover:bg-foreground/10 disabled:opacity-40"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
