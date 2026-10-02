import { motion } from 'motion/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { MinusIcon, PlusIcon, UsersIcon, XIcon } from 'lucide-react'
import { SeatAvatar, useSeats } from '#/components/receipt/seats.tsx'
import { Button } from '#/components/ui/button.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { joinLabels } from '#/lib/participant-labels.ts'
import { cn } from '#/lib/utils.ts'
import { unitKey } from '../../../shared/claim-groups.ts'
import type {
  ClaimGroup,
  ClaimGroupSeatView,
  UnitRef,
} from '../../../shared/claim-groups.ts'
import { splitUnitShareAmongAssignees } from '../../../shared/unit-share-allocation.ts'

/** The small panel that opens under a receipt line. */
export function LinePanel({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="-mx-2 overflow-hidden bg-paper-2"
      role="region"
      aria-label={title}
    >
      <div className="border-l-[3px] border-ink px-3 pt-1 pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-sans text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Затвори"
            className="-mr-2 grid size-11 place-items-center text-ink-muted hover:text-ink"
          >
            <XIcon className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </motion.div>
  )
}

export interface LineActions {
  busy: boolean
  take: () => Promise<boolean>
  takeAll: () => Promise<boolean>
  release: () => Promise<boolean>
  share: (withIds: string[], unit?: UnitRef) => Promise<boolean>
  join: (unit: UnitRef) => Promise<boolean>
  leave: (unit: UnitRef) => Promise<boolean>
}

/**
 * Claiming one line for one seat: a quantity stepper, sharing a Unit with
 * chosen people (price preview), and joining a Unit someone already has.
 */
export function ClaimLineDrawer({
  group,
  view,
  actorId,
  title,
  participants,
  labels,
  actions,
  onClose,
}: {
  group: ClaimGroup
  view: ClaimGroupSeatView
  actorId: string
  title: string
  participants: Array<{ id: string; sortOrder: number }>
  labels: Record<string, string>
  actions: LineActions
  onClose: () => void
}) {
  const seats = useSeats()
  const [withIds, setWithIds] = useState<string[]>([])
  /** Editing who else is on one of the actor's Shared Units. */
  const [editing, setEditing] = useState<UnitRef | null>(null)
  const others = seats.filter((seat) => seat.id !== actorId)
  const canShare =
    editing !== null || view.mySoloUnits.length > 0 || view.freeUnits.length > 0
  const preview =
    withIds.length > 0
      ? (splitUnitShareAmongAssignees(
          group.unitPriceCents,
          [actorId, ...withIds],
          participants,
        ).find((portion) => portion.id === actorId)?.cents ?? 0)
      : 0
  const names = (ids: string[]) =>
    joinLabels(ids.map((id) => labels[id] ?? 'Участник'))

  async function submitShare() {
    const ok = await actions.share(withIds, editing ?? undefined)
    if (ok) {
      setWithIds([])
      setEditing(null)
    }
  }

  return (
    <LinePanel title={title} onClose={onClose}>
      {group.units.length > 1 ? (
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <div
            className="flex items-center rounded-full border-2 border-ink"
            role="group"
            aria-label={`Бройки ${group.name}`}
          >
            <button
              type="button"
              aria-label={`Една ${group.name} по-малко`}
              disabled={actions.busy || view.mySoloUnits.length === 0}
              onClick={() => void actions.release()}
              className="grid size-11 place-items-center disabled:opacity-30"
            >
              <MinusIcon className="size-4" strokeWidth={2} aria-hidden />
            </button>
            <span
              className="w-8 text-center font-display text-[16px] font-bold"
              aria-live="polite"
            >
              {view.myUnitCount}
            </span>
            <button
              type="button"
              aria-label={`Още една ${group.name}`}
              disabled={actions.busy || view.freeUnits.length === 0}
              onClick={() => void actions.take()}
              className="grid size-11 place-items-center disabled:opacity-30"
            >
              <PlusIcon className="size-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <span className="text-[11px] leading-snug text-ink-muted">
            {view.myUnitCount > 0
              ? `ваши ${formatEur(view.myShareCents)}`
              : 'още нямате'}
            <br />
            свободни {view.freeUnits.length} от {view.totalUnits}
          </span>
          {view.freeUnits.length > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto"
              disabled={actions.busy}
              onClick={() => void actions.takeAll()}
            >
              Вземи всички {view.freeUnits.length}
            </Button>
          ) : null}
        </div>
      ) : null}

      {view.mySharedUnits.length > 0 ? (
        <ul className="mb-3 space-y-1">
          {view.mySharedUnits.map((shared) => (
            <li
              key={unitKey(shared.unit)}
              className="flex min-h-11 items-center gap-2 text-[12px]"
            >
              <UsersIcon
                className="size-4 shrink-0 text-ink-muted"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                Делите с {names(shared.coMemberIds)}, ваши{' '}
                {formatEur(shared.myShareCents)}
              </span>
              <button
                type="button"
                className="min-h-11 px-1.5 text-[11px] font-semibold underline decoration-dotted decoration-2 underline-offset-4"
                disabled={actions.busy}
                onClick={() => {
                  setEditing(shared.unit)
                  setWithIds(shared.coMemberIds)
                }}
              >
                Промени
              </button>
              <button
                type="button"
                className="min-h-11 px-1.5 text-[11px] font-semibold underline decoration-dotted decoration-2 underline-offset-4"
                disabled={actions.busy}
                onClick={() => void actions.leave(shared.unit)}
              >
                Махни ме
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="rule pt-2">
        <p className="mb-1.5 text-[12px] font-semibold">
          {editing
            ? 'С кого делите тази бройка?'
            : 'Делихте бройка? Сподели с:'}
        </p>
        <div className="scroll-x-quiet -mx-1 flex gap-1 overflow-x-auto px-1">
          {others.map((seat) => {
            const on = withIds.includes(seat.id)
            return (
              <button
                key={seat.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setWithIds((ids) =>
                    on ? ids.filter((id) => id !== seat.id) : [...ids, seat.id],
                  )
                }
                className={cn(
                  'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 py-1 pr-3 pl-1 text-[12px]',
                  on
                    ? 'border-ink bg-paper font-semibold'
                    : 'border-transparent',
                )}
              >
                <SeatAvatar seat={seat} size="sm" />
                {seat.label}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={actions.busy || withIds.length === 0 || !canShare}
            onClick={() => void submitShare()}
          >
            {editing ? 'Запази' : 'Сподели 1 бройка'}
          </Button>
          {editing ? (
            <button
              type="button"
              className="min-h-11 text-[11px] underline decoration-dotted decoration-2 underline-offset-4"
              onClick={() => {
                setEditing(null)
                setWithIds([])
              }}
            >
              Откажи
            </button>
          ) : null}
          <span className="text-[11px] text-ink-muted">
            {!canShare
              ? 'Няма свободна или ваша бройка за делене.'
              : withIds.length > 0
                ? `вие плащате ${formatEur(preview)}`
                : 'Изберете с кого.'}
          </span>
        </div>
      </div>

      {view.joinOptions.length > 0 ? (
        <div className="rule mt-3 pt-2">
          <p className="mb-1 text-[12px] font-semibold">
            Ядохте от чужда бройка?
          </p>
          {view.joinOptions.slice(0, 3).map((option) => (
            <div
              key={option.memberIds.join('+')}
              className="flex min-h-11 items-center gap-2 text-[12px]"
            >
              <span className="min-w-0 flex-1">
                При {names(option.memberIds)}, вие ще платите{' '}
                <b>{formatEur(option.joinedShareCents)}</b>
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={actions.busy}
                onClick={() => void actions.join(option.units[0])}
              >
                Споделихме я
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </LinePanel>
  )
}
