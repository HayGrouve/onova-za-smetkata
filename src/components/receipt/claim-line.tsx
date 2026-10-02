import { AnimatePresence, motion } from 'motion/react'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangleIcon, MinusIcon, MoreHorizontalIcon } from 'lucide-react'
import { SeatAvatar, useSeatLookup } from '#/components/receipt/seats.tsx'
import { formatEur } from '#/lib/format-currency.ts'
import { cn } from '#/lib/utils.ts'
import { unitKey } from '../../../shared/claim-groups.ts'
import type { ClaimGroup, UnitRef } from '../../../shared/claim-groups.ts'

/**
 * paint: host has a seat as the brush, a tap gives that seat a Unit.
 * inspect: host without a brush, a tap opens the line's Units.
 * claim: guest, a tap takes a Unit.
 * readonly: final or settling, no taps.
 */
export type LineMode = 'paint' | 'inspect' | 'claim' | 'readonly'

const LONG_PRESS_MS = 480

/**
 * One receipt line (a Claim group). The whole line is the tap target; one
 * slot per Unit shows who has it: dashed when free, seat avatars when taken.
 */
export function ClaimLine({
  group,
  membersOf,
  mode,
  highlightIds = [],
  countIds = highlightIds,
  open = false,
  error,
  disabled = false,
  onTap,
  onMore,
  onReleaseUnit,
  tapLabel,
  after,
}: {
  group: ClaimGroup
  membersOf: (unit: UnitRef) => string[]
  mode: LineMode
  /** Seats to emphasise: the guest's own seats, or the host's brush. */
  highlightIds?: string[]
  /** Seats counted in „ваши N“ (the seat being marked for). */
  countIds?: string[]
  open?: boolean
  error?: string | null
  disabled?: boolean
  onTap?: () => void
  onMore?: () => void
  /** Guest: tapping your own avatar in a slot gives that Unit back. */
  onReleaseUnit?: (unit: UnitRef, seatId: string) => void
  /** Accessible name of the tap action, e.g. „Мое“. */
  tapLabel?: string
  /** Rendered inside the line under it (the line's Units panel). */
  after?: ReactNode
}) {
  const count = group.units.length
  const members = group.units.map((unit) => membersOf(unit))
  const claimed = members.filter((ids) => ids.length > 0).length
  const free = count - claimed
  const untouched = claimed === 0
  const mine = members.filter((ids) =>
    ids.some((id) => countIds.includes(id)),
  ).length
  const seatOf = useSeatLookup()
  const sharedWith = [
    ...new Set(
      members
        .filter(
          (ids) => ids.length > 1 && ids.some((id) => countIds.includes(id)),
        )
        .flat()
        .filter((id) => !countIds.includes(id)),
    ),
  ].map((id) => seatOf(id)?.label ?? 'друг')
  const press = useRef<{ timer?: number; fired: boolean }>({ fired: false })
  const interactive = mode !== 'readonly' && !!onTap && !disabled

  function startPress() {
    if (!onMore || mode === 'readonly') return
    press.current.fired = false
    press.current.timer = window.setTimeout(() => {
      press.current.fired = true
      onMore()
    }, LONG_PRESS_MS)
  }
  function endPress() {
    window.clearTimeout(press.current.timer)
  }

  const hint =
    mode === 'claim' && mine > 0 ? (
      <>
        ваши <span data-testid={`claim-count-${group.itemIds[0]}`}>{mine}</span>
        {sharedWith.length > 0 ? `, делите с ${sharedWith.join(', ')}` : null}
      </>
    ) : untouched && mode !== 'readonly' ? (
      'никой още'
    ) : null

  return (
    <motion.li
      data-line={group.key}
      data-testid={`claim-group-${group.itemIds[0]}`}
      layout="position"
      className={cn('relative -mx-2 list-none', open && 'bg-paper-2')}
    >
      <div className="flex items-stretch">
        <div className="relative min-w-0 flex-1">
          <button
            type="button"
            disabled={!interactive}
            onClick={() => {
              if (press.current.fired) {
                press.current.fired = false
                return
              }
              onTap?.()
            }}
            onPointerDown={startPress}
            onPointerUp={endPress}
            onPointerLeave={endPress}
            onPointerCancel={endPress}
            onContextMenu={(event) => {
              if (onMore) event.preventDefault()
            }}
            className={cn(
              'absolute inset-0 transition-colors disabled:cursor-default',
              interactive && 'hover:bg-paper-2 active:bg-paper-2',
            )}
            aria-label={`${tapLabel ? `${tapLabel}: ` : ''}${group.name}, ${formatEur(group.unitPriceCents)} за бройка, свободни ${free} от ${count}${mine > 0 ? `, ваши ${mine}` : ''}`}
          />
          <div className="pointer-events-none relative min-h-[60px] px-2 py-2.5">
            <span
              className={cn(
                'flex items-baseline',
                untouched && mode !== 'readonly' && 'text-ink-muted',
              )}
            >
              <span
                className={cn(
                  'min-w-0 font-medium',
                  untouched && mode !== 'readonly' && 'italic',
                )}
              >
                {group.name}
              </span>
              <span className="leader" aria-hidden />
              <span className="shrink-0 font-semibold">
                {formatEur(group.unitPriceCents * count)}
              </span>
            </span>
            <span className="mt-1.5 flex items-center justify-between gap-2">
              <span className="shrink-0 text-[11px] text-ink-muted">
                {count > 1
                  ? `${count} × ${formatEur(group.unitPriceCents)}`
                  : '1 бр.'}
                {hint ? (
                  <>
                    <span aria-hidden> / </span>
                    <span className={cn(mine > 0 && 'font-semibold text-ink')}>
                      {hint}
                    </span>
                  </>
                ) : null}
              </span>
              <Slots
                group={group}
                members={members}
                highlightIds={highlightIds}
                onReleaseUnit={
                  mode === 'claim' && !disabled ? onReleaseUnit : undefined
                }
              />
            </span>
          </div>
        </div>
        {onMore && mode !== 'readonly' ? (
          <button
            type="button"
            onClick={onMore}
            aria-expanded={open}
            aria-label={`Бройки на ${group.name}`}
            className={cn(
              'flex w-11 shrink-0 items-center justify-center text-ink-muted hover:text-ink',
              open && 'text-ink',
            )}
          >
            <MoreHorizontalIcon
              className="size-5"
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      <AnimatePresence initial={false}>
        {error ? (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 overflow-hidden px-2 pb-2 text-[11px] font-semibold text-ink"
          >
            <AlertTriangleIcon
              className="size-3.5 shrink-0 text-stamp"
              strokeWidth={2}
              aria-hidden
            />
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>
      {after}
    </motion.li>
  )
}

/**
 * One slot per Unit: dashed when free, seat avatars when taken (stacked when
 * shared). On a guest phone your own slots are buttons with a minus badge.
 */
function Slots({
  group,
  members,
  highlightIds,
  onReleaseUnit,
}: {
  group: ClaimGroup
  members: string[][]
  highlightIds: string[]
  onReleaseUnit?: (unit: UnitRef, seatId: string) => void
}) {
  const seatOf = useSeatLookup()
  const many = group.units.length > 6
  return (
    <span
      data-slots
      className="flex min-w-0 flex-wrap items-center justify-end gap-1.5"
    >
      {group.units.map((unit, unitIdx) => {
        const ids = members[unitIdx] ?? []
        const key = unitKey(unit)
        if (ids.length === 0) {
          return (
            <span
              key={key}
              data-free
              className={cn(
                'inline-block rounded-full border-[1.5px] border-dashed border-ink-faint',
                many ? 'size-4' : 'size-[22px]',
              )}
            />
          )
        }
        const heldBy = ids.find((id) => highlightIds.includes(id))
        const avatars = (
          <AnimatePresence initial={false}>
            {ids.map((id, i) => {
              const seat = seatOf(id)
              if (!seat) return null
              return (
                <motion.span
                  key={id}
                  initial={{ scale: 0.2, y: -18, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.2, opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 520,
                    damping: 18,
                    delay: 0.35,
                  }}
                  className={cn('inline-flex', i > 0 && '-ml-1')}
                  title={seat.label}
                >
                  <SeatAvatar
                    seat={seat}
                    size="xs"
                    className="ring-[1.5px] ring-paper"
                  />
                </motion.span>
              )
            })}
          </AnimatePresence>
        )
        const slotClass = cn(
          'relative inline-flex items-center rounded-full',
          ids.length > 1 && 'bg-paper-2 p-px pr-1',
          heldBy && 'outline-2 outline-offset-1 outline-ink outline-solid',
        )
        const share =
          ids.length > 1 ? (
            <span className="ml-0.5 text-[10px] font-semibold text-ink-muted">
              1/{ids.length}
            </span>
          ) : null
        if (heldBy && onReleaseUnit) {
          return (
            <button
              key={key}
              type="button"
              onClick={() => onReleaseUnit(unit, heldBy)}
              aria-label={`Върни бройка ${unitIdx + 1} от ${group.name}${ids.length > 1 ? ', махни ме от споделената' : ''}`}
              className={cn(
                slotClass,
                "pointer-events-auto after:absolute after:-inset-[11px] after:content-['']",
              )}
            >
              {avatars}
              {share}
              <span className="absolute -right-1.5 -bottom-1.5 grid size-[14px] place-items-center rounded-full bg-ink text-paper ring-[1.5px] ring-paper">
                <MinusIcon className="size-2.5" strokeWidth={3.5} aria-hidden />
              </span>
            </button>
          )
        }
        return (
          <span key={key} className={slotClass}>
            {avatars}
            {share}
          </span>
        )
      })}
    </span>
  )
}
