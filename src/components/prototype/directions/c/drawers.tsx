/** PROTOTYPE Direction C: the small panel that opens under a receipt line (unit-level edits). */
import { motion } from 'motion/react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Minus, Plus, Users, X } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { useProto } from '../mock/store.tsx'
import type { ClaimGroup } from '../../../../../shared/claim-groups.ts'
import { unitKey } from '../../../../../shared/claim-groups.ts'
import { SeatAvatar, formatMoney, seatIndex } from './ui.tsx'

function Panel({
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
      className="-mx-2 overflow-hidden bg-[var(--c-paper-2)]"
    >
      <div className="border-l-[3px] border-[var(--c-ink)] px-3 pb-3 pt-1">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-muted)]">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Затвори"
            className="-mr-2 grid size-11 place-items-center text-[var(--c-ink-muted)] hover:text-[var(--c-ink)]"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </motion.div>
  )
}

/** Host: per-Unit membership toggles. One person = whole Unit, several = Shared Unit. */
export function HostUnitDrawer({
  group,
  onClose,
}: {
  group: ClaimGroup
  onClose: () => void
}) {
  const { derived, dispatch } = useProto()
  return (
    <Panel title="Кой какво от този ред" onClose={onClose}>
      <p className="mb-2 text-[11px] leading-snug text-[var(--c-ink-muted)]">
        Отбележете кой е ял от всяка бройка. Двама или повече делят цената
        поравно.
      </p>
      <ul className="space-y-2">
        {group.units.map((u, i) => {
          const ids = derived.unitMembers(u)
          return (
            <li key={unitKey(u)} className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-[11px] leading-tight">
                Бр. {i + 1}
                <span className="block text-[var(--c-ink-muted)]">
                  {ids.length === 0
                    ? 'свободна'
                    : ids.length === 1
                      ? formatMoney(group.unitPriceCents)
                      : `по ${formatMoney(Math.round(group.unitPriceCents / ids.length))}`}
                </span>
              </span>
              <div className="c-scroll-x flex min-w-0 flex-1 gap-1 overflow-x-auto">
                {derived.seats.map((s) => {
                  const on = ids.includes(s.participantId)
                  return (
                    <button
                      key={s.participantId}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${s.name}, бройка ${i + 1}`}
                      onClick={() =>
                        dispatch({
                          type: 'setUnitMembers',
                          unit: u,
                          participantIds: on
                            ? ids.filter((x) => x !== s.participantId)
                            : [...ids, s.participantId],
                        })
                      }
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-full transition-opacity',
                        !on && 'opacity-35 grayscale hover:opacity-70',
                      )}
                    >
                      <SeatAvatar
                        seat={s}
                        index={seatIndex(derived.seats, s.participantId)}
                        size="sm"
                        className={cn(
                          on &&
                            'ring-2 ring-[var(--c-ink)] ring-offset-2 ring-offset-[var(--c-paper-2)]',
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
    </Panel>
  )
}

/** Guest: quantity stepper, share a Unit, or join a Unit someone already has. */
export function GuestLineDrawer({
  group,
  actorId,
  onClose,
  onTake,
}: {
  group: ClaimGroup
  actorId: string
  onClose: () => void
  onTake: () => void
}) {
  const { derived, dispatch } = useProto()
  const [withIds, setWithIds] = useState<string[]>([])
  const view = derived.seatView(group.key, actorId)
  const actor = derived.seats.find((s) => s.participantId === actorId)
  const others = derived.seats.filter((s) => s.participantId !== actorId)
  const canShare = view.mySoloUnits.length > 0 || view.freeUnits.length > 0
  const perHead = Math.round(group.unitPriceCents / (withIds.length + 1))

  return (
    <Panel
      title={
        actor && !actor.isHost ? `${group.name}, за ${actor.name}` : group.name
      }
      onClose={onClose}
    >
      {group.units.length > 1 && (
        <div className="flex flex-wrap items-center gap-3 pb-3">
          <div className="flex items-center rounded-full border-2 border-[var(--c-ink)]">
            <button
              type="button"
              aria-label="Една по-малко"
              disabled={view.mySoloUnits.length === 0}
              onClick={() =>
                dispatch({
                  type: 'releaseUnit',
                  groupKey: group.key,
                  participantId: actorId,
                })
              }
              className="grid size-11 place-items-center disabled:opacity-30"
            >
              <Minus className="size-4" strokeWidth={2} aria-hidden />
            </button>
            <span
              className="c-display w-8 text-center text-[16px] font-bold"
              aria-live="polite"
            >
              {view.myUnitCount}
            </span>
            <button
              type="button"
              aria-label="Още една"
              disabled={view.freeUnits.length === 0}
              onClick={onTake}
              className="grid size-11 place-items-center disabled:opacity-30"
            >
              <Plus className="size-4" strokeWidth={2} aria-hidden />
            </button>
          </div>
          <span className="text-[11px] text-[var(--c-ink-muted)]">
            {view.myUnitCount > 0
              ? `ваши ${formatMoney(view.myShareCents)}`
              : 'още нямате'}
            <br />
            свободни {view.freeUnits.length} от {view.totalUnits}
          </span>
          {view.freeUnits.length > 1 && (
            <button
              type="button"
              className="c-ghost ml-auto text-[var(--c-ink)]"
              onClick={() => {
                for (const _ of view.freeUnits)
                  dispatch({
                    type: 'takeUnit',
                    groupKey: group.key,
                    participantId: actorId,
                  })
              }}
            >
              Вземи всички {view.freeUnits.length}
            </button>
          )}
        </div>
      )}

      {view.mySharedUnits.length > 0 && (
        <ul className="mb-3 space-y-1">
          {view.mySharedUnits.map((su) => (
            <li
              key={unitKey(su.unit)}
              className="flex min-h-11 items-center gap-2 text-[12px]"
            >
              <Users
                className="size-4 shrink-0 text-[var(--c-ink-muted)]"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                Делите с{' '}
                {su.coMemberIds.map((id) => derived.labels[id]).join(', ')},
                ваши {formatMoney(su.myShareCents)}
              </span>
              <button
                type="button"
                className="min-h-11 px-2 text-[11px] font-semibold underline underline-offset-2"
                onClick={() =>
                  dispatch({
                    type: 'leaveUnit',
                    unit: su.unit,
                    participantId: actorId,
                  })
                }
              >
                Махни ме
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t-2 border-dashed border-[var(--c-rule)] pt-2">
        <p className="mb-1.5 text-[12px] font-semibold">
          Делихте бройка? Сподели с:
        </p>
        <div className="c-scroll-x -mx-1 flex gap-1 overflow-x-auto px-1">
          {others.map((s) => {
            const on = withIds.includes(s.participantId)
            return (
              <button
                key={s.participantId}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setWithIds((w) =>
                    on
                      ? w.filter((x) => x !== s.participantId)
                      : [...w, s.participantId],
                  )
                }
                className={cn(
                  'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-3 text-[12px]',
                  on
                    ? 'border-[var(--c-ink)] bg-[var(--c-paper)] font-semibold'
                    : 'border-transparent',
                )}
              >
                <SeatAvatar
                  seat={s}
                  index={seatIndex(derived.seats, s.participantId)}
                  size="sm"
                />
                {s.name}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            className="c-ink-btn"
            disabled={withIds.length === 0 || !canShare}
            style={{ opacity: withIds.length === 0 || !canShare ? 0.4 : 1 }}
            onClick={() => {
              dispatch({
                type: 'shareUnit',
                groupKey: group.key,
                actorId,
                withParticipantIds: withIds,
              })
              setWithIds([])
            }}
          >
            Сподели 1 бройка
          </button>
          <span className="text-[11px] text-[var(--c-ink-muted)]">
            {!canShare
              ? 'Няма свободна или ваша бройка за делене.'
              : withIds.length > 0
                ? `по ${formatMoney(perHead)} на човек`
                : 'Изберете с кого.'}
          </span>
        </div>
      </div>

      {view.joinOptions.length > 0 && (
        <div className="mt-3 border-t-2 border-dashed border-[var(--c-rule)] pt-2">
          <p className="mb-1 text-[12px] font-semibold">
            Ядохте от чужда бройка?
          </p>
          {view.joinOptions.slice(0, 3).map((opt) => (
            <div
              key={opt.memberIds.join('+')}
              className="flex min-h-11 items-center gap-2 text-[12px]"
            >
              <span className="min-w-0 flex-1">
                При {opt.memberIds.map((id) => derived.labels[id]).join(' и ')},
                вие ще платите <b>{formatMoney(opt.joinedShareCents)}</b>
              </span>
              <button
                type="button"
                className="c-ghost text-[var(--c-ink)]"
                onClick={() =>
                  dispatch({
                    type: 'joinUnit',
                    unit: opt.units[0],
                    participantId: actorId,
                  })
                }
              >
                Споделихме я
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
