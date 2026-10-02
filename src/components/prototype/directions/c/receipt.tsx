/** PROTOTYPE Direction C: the receipt object (paper, header, phase timeline, lines, totals). */
import { AnimatePresence, motion } from 'motion/react'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  Link2,
  Minus,
  MoreHorizontal,
  Share2,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { useProto } from '../mock/store.tsx'
import type { ClaimGroup, UnitRef } from '../../../../../shared/claim-groups.ts'
import { unitKey } from '../../../../../shared/claim-groups.ts'
import {
  BILL_URL,
  SeatAvatar,
  clock,
  useHydrated,
  formatMoney,
  seatIndex,
  shareOrCopy,
  useCopy,
} from './ui.tsx'

export type Phase = 'assemble' | 'table' | 'settle'

export const PHASES: Array<{ key: Phase; label: string }> = [
  { key: 'assemble', label: 'Сглобяване' },
  { key: 'table', label: 'На масата' },
  { key: 'settle', label: 'Разплащане' },
]

/* ------------------------------------------------------------- timeline */

export function Timeline({
  phase,
  onPhase,
  final,
  className,
}: {
  phase: Phase
  onPhase?: (p: Phase) => void
  final?: boolean
  className?: string
}) {
  const current = PHASES.findIndex((p) => p.key === phase)
  return (
    <ol
      className={cn('flex items-stretch gap-1', className)}
      aria-label="Етап на сметката"
    >
      {PHASES.map((p, i) => {
        const done = final || i < current
        const active = !final && i === current
        const inner = (
          <>
            <span
              className={cn(
                'mb-1.5 block h-[3px] w-full rounded-full',
                active
                  ? 'bg-[var(--c-accent)]'
                  : done
                    ? 'bg-[var(--c-on-table)]'
                    : 'bg-[var(--c-table-3)]',
              )}
            />
            <span
              className={cn(
                'flex items-center gap-1 text-[11px] leading-tight',
                active
                  ? 'c-display font-bold text-[var(--c-on-table)]'
                  : 'text-[var(--c-on-table-muted)]',
              )}
            >
              {done && (
                <Check className="size-3" strokeWidth={2.25} aria-hidden />
              )}
              {p.label}
            </span>
          </>
        )
        return (
          <li
            key={p.key}
            className="min-w-0 flex-1"
            aria-current={active ? 'step' : undefined}
          >
            {onPhase ? (
              <button
                type="button"
                onClick={() => onPhase(p.key)}
                className="flex min-h-11 w-full flex-col items-start justify-center text-left"
              >
                {inner}
              </button>
            ) : (
              <div className="flex min-h-11 flex-col justify-center">
                {inner}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ---------------------------------------------------------------- paper */

export function Paper({
  children,
  className,
  topOnly,
}: {
  children: ReactNode
  className?: string
  /** Bottom edge continues into the slips (no zig-zag). */
  topOnly?: boolean
}) {
  return (
    <div className="c-paper-shadow">
      <div
        className={cn(
          topOnly ? 'c-paper-top' : 'c-paper',
          'c-thermal relative px-4 sm:px-6',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

export function Rule({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'my-3 border-t-2 border-dashed border-[var(--c-rule)]',
        className,
      )}
    />
  )
}

export function ReceiptHeader({
  title,
  date,
  children,
}: {
  title: ReactNode
  date: number
  children?: ReactNode
}) {
  const d = new Date(date)
  const hydrated = useHydrated()
  return (
    <header className="pb-1">
      <div className="flex items-baseline justify-between gap-3 text-[11px] text-[var(--c-ink-muted)]">
        <span suppressHydrationWarning>
          {hydrated
            ? `${d.toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${clock(date)}`
            : ' '}
        </span>
        <span>Маса на Даниел</span>
      </div>
      <div className="mt-2">{title}</div>
      {children}
    </header>
  )
}

export function RestaurantTitle({ name }: { name: string }) {
  return (
    <h1 className="c-display text-[22px] font-bold uppercase leading-[1.1] tracking-[-0.01em] text-[var(--c-ink)] sm:text-[26px]">
      {name || 'Без име'}
    </h1>
  )
}

/** Ticket stub on the header: the join link with real copy and share actions. */
export function LinkStub() {
  const [copied, copy] = useCopy()
  const url = `https://${BILL_URL}`
  return (
    <div className="mt-3 flex items-center gap-2 border-2 border-dashed border-[var(--c-rule)] py-1.5 pl-3 pr-1.5">
      <Link2
        className="size-4 shrink-0 text-[var(--c-ink-muted)]"
        strokeWidth={1.75}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate text-[12px]">{BILL_URL}</span>
      <button
        type="button"
        onClick={() => copy('link', url)}
        className="c-ghost min-w-[92px] text-[var(--c-ink)]"
        aria-live="polite"
      >
        {copied === 'link' ? 'Копирано' : 'Копирай'}
      </button>
      <button
        type="button"
        onClick={() =>
          void shareOrCopy({
            title: 'Механа Чучура',
            text: 'Отбележете какво консумирахте:',
            url,
          }).then((didCopy) => didCopy && copy('link', url))
        }
        className="c-ink-btn !px-3"
        aria-label="Сподели линка"
      >
        <Share2 className="size-4" strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- lines */

export type LineMode = 'paint' | 'inspect' | 'claim' | 'readonly'

export function ClaimLine({
  group,
  mode,
  highlightIds = [],
  open,
  error,
  onTap,
  onMore,
  onReleaseUnit,
  index = 0,
  print = true,
}: {
  group: ClaimGroup
  mode: LineMode
  /** Seats to emphasise on this phone (guest's own seats, or the brush). */
  highlightIds?: string[]
  open?: boolean
  error?: string | null
  onTap?: () => void
  onMore?: () => void
  /** Guest: tapping your own avatar in a slot gives that Unit back. */
  onReleaseUnit?: (unit: UnitRef, seatId: string) => void
  index?: number
  /** Animate the line "printing" in when it mounts. */
  print?: boolean
}) {
  const { derived } = useProto()
  const count = group.units.length
  const members = group.units.map((u) => derived.unitMembers(u))
  const claimed = members.filter((m) => m.length > 0).length
  const free = count - claimed
  const untouched = claimed === 0
  const mine = members.filter((m) =>
    m.some((id) => highlightIds.includes(id)),
  ).length
  const press = useRef<{ t?: number; fired: boolean }>({ fired: false })

  const interactive = mode !== 'readonly' && !!onTap

  const startPress = () => {
    if (!onMore) return
    press.current.fired = false
    press.current.t = window.setTimeout(() => {
      press.current.fired = true
      onMore()
    }, 480)
  }
  const endPress = () => window.clearTimeout(press.current.t)

  const hint =
    mode === 'claim' && mine > 0
      ? `ваши ${mine}`
      : untouched && mode !== 'readonly'
        ? 'никой още'
        : null

  return (
    <motion.li
      data-line={group.key}
      layout="position"
      initial={
        print ? { opacity: 0, y: -10, clipPath: 'inset(0 0 100% 0)' } : false
      }
      animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0)' }}
      transition={{
        duration: 0.32,
        delay: index * 0.07,
        ease: [0.2, 0.8, 0.3, 1],
      }}
      className={cn(
        'relative -mx-2 list-none',
        open && 'bg-[var(--c-paper-2)]',
      )}
    >
      <div className="flex items-stretch">
        {/* The whole line is the tap target; slot avatars sit above it as their own buttons. */}
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
            onContextMenu={(e) => {
              if (onMore) e.preventDefault()
            }}
            className={cn(
              'absolute inset-0 transition-colors',
              interactive &&
                'hover:bg-[var(--c-paper-2)] active:bg-[var(--c-paper-2)]',
            )}
            aria-label={`${group.name}, ${formatMoney(group.unitPriceCents)} за бройка, свободни ${free} от ${count}${mine > 0 ? `, ваши ${mine}` : ''}`}
          />
          <div className="pointer-events-none relative min-h-[60px] px-2 py-2.5">
            <span
              className={cn(
                'flex items-baseline',
                untouched && mode !== 'readonly' && 'text-[var(--c-ink-muted)]',
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
              <span className="c-leader" />
              <span className="shrink-0 font-semibold">
                {formatMoney(group.unitPriceCents * count)}
              </span>
            </span>
            <span className="mt-1.5 flex items-center justify-between gap-2">
              <span className="shrink-0 text-[11px] text-[var(--c-ink-muted)]">
                {count > 1
                  ? `${count} × ${formatMoney(group.unitPriceCents)}`
                  : '1 бр.'}
                {hint && (
                  <>
                    <span aria-hidden> / </span>
                    <span
                      className={cn(
                        mine > 0 && 'font-semibold text-[var(--c-ink)]',
                      )}
                    >
                      {hint}
                    </span>
                  </>
                )}
              </span>
              <Slots
                group={group}
                highlightIds={highlightIds}
                onReleaseUnit={mode === 'claim' ? onReleaseUnit : undefined}
              />
            </span>
          </div>
        </div>
        {onMore && mode !== 'readonly' && (
          <button
            type="button"
            onClick={onMore}
            aria-expanded={open}
            aria-label={`Бройки на ${group.name}`}
            className={cn(
              'flex w-11 shrink-0 items-center justify-center text-[var(--c-ink-muted)] hover:text-[var(--c-ink)]',
              open && 'text-[var(--c-ink)]',
            )}
          >
            <MoreHorizontal className="size-5" strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-1.5 overflow-hidden px-2 pb-2 text-[11px] font-semibold text-[var(--c-ink)]"
          >
            <AlertTriangle
              className="size-3.5 shrink-0 text-[var(--c-accent)]"
              strokeWidth={2}
              aria-hidden
            />
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.li>
  )
}

/**
 * One slot per Unit: dashed when free, seat avatars when taken (stacked when
 * shared). On a guest phone your own slots are buttons with a minus badge.
 */
function Slots({
  group,
  highlightIds,
  onReleaseUnit,
}: {
  group: ClaimGroup
  highlightIds: string[]
  onReleaseUnit?: (unit: UnitRef, seatId: string) => void
}) {
  const { derived } = useProto()
  const many = group.units.length > 6
  return (
    <span
      data-slots
      className="flex min-w-0 flex-wrap items-center justify-end gap-1.5"
    >
      {group.units.map((u, unitIdx) => {
        const ids = derived.unitMembers(u)
        const key = unitKey(u)
        if (ids.length === 0)
          return (
            <span
              key={key}
              className={cn(
                'inline-block rounded-full border-[1.5px] border-dashed border-[var(--c-ink-faint)]',
                many ? 'size-4' : 'size-[22px]',
              )}
            />
          )
        const heldBy = ids.find((id) => highlightIds.includes(id))
        const avatars = (
          <AnimatePresence initial={false}>
            {ids.map((id, i) => {
              const seat = derived.seats.find((s) => s.participantId === id)
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
                  title={seat.name}
                >
                  <SeatAvatar
                    seat={seat}
                    index={seatIndex(derived.seats, id)}
                    size="xs"
                    className="ring-[1.5px] ring-[var(--c-paper)]"
                  />
                </motion.span>
              )
            })}
          </AnimatePresence>
        )
        const cls = cn(
          'relative inline-flex items-center rounded-full',
          ids.length > 1 && 'bg-[var(--c-paper-2)] p-px pr-1',
          heldBy && 'outline outline-2 outline-offset-1 outline-[var(--c-ink)]',
        )
        const share = ids.length > 1 && (
          <span className="ml-0.5 text-[10px] font-semibold text-[var(--c-ink-muted)]">
            1/{ids.length}
          </span>
        )
        if (heldBy && onReleaseUnit)
          return (
            <button
              key={key}
              type="button"
              onClick={() => onReleaseUnit(u, heldBy)}
              aria-label={`Върни бройка ${unitIdx + 1} от ${group.name}${ids.length > 1 ? ', махни ме от споделената' : ''}`}
              className={cn(
                cls,
                "pointer-events-auto after:absolute after:-inset-[11px] after:content-['']",
              )}
            >
              {avatars}
              {share}
              <span className="absolute -bottom-1.5 -right-1.5 grid size-[14px] place-items-center rounded-full bg-[var(--c-ink)] text-[var(--c-paper)] ring-[1.5px] ring-[var(--c-paper)]">
                <Minus className="size-2.5" strokeWidth={3.5} aria-hidden />
              </span>
            </button>
          )
        return (
          <span key={key} className={cls}>
            {avatars}
            {share}
          </span>
        )
      })}
    </span>
  )
}

/* --------------------------------------------------------------- totals */

export function Totals({ children }: { children?: ReactNode }) {
  const { derived, state } = useProto()
  return (
    <div className="space-y-1 text-[12px]">
      <div className="flex items-baseline">
        <span>Сума на редовете</span>
        <span className="c-leader" />
        <span>{formatMoney(derived.subtotalCents)}</span>
      </div>
      <div className="flex items-baseline">
        <span>Бакшиш {state.bill.tipPercent}%</span>
        <span className="c-leader" />
        <span>{formatMoney(derived.tipCents)}</span>
      </div>
      {children}
      <div className="flex items-baseline pt-2">
        <span className="c-display text-[15px] font-bold uppercase">Общо</span>
        <span className="c-leader" />
        <span className="c-display text-[22px] font-bold">
          {formatMoney(derived.subtotalCents + derived.tipCents)}
        </span>
      </div>
    </div>
  )
}
