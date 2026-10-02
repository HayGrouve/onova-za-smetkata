/** PROTOTYPE Direction C: things around the receipt (seats rail, live ticker, feed, slips, undo). */
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Banknote, Bell, Check, Clock3, Plus, Undo2, X } from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { useProto } from '../mock/store.tsx'
import type { SeatSummary } from '../mock/store.tsx'
import {
  BILL_URL,
  SeatAvatar,
  Stamp,
  clock,
  useHydrated,
  formatMoney,
  seatIndex,
  shareOrCopy,
  useCopy,
} from './ui.tsx'

/* ------------------------------------------------------------ seats rail */

export function SeatsRail({
  orientation = 'row',
  brushId,
  onSeat,
  onAdd,
  label,
  onTable = true,
  meId,
}: {
  /** The viewer's own seat (labelled „Вие“). */
  meId?: string | null
  orientation?: 'row' | 'column'
  brushId?: string | null
  onSeat?: (id: string) => void
  onAdd?: () => void
  label?: string
  /** Rendered on the table surface (vs on paper). */
  onTable?: boolean
}) {
  const { derived, state } = useProto()
  const claiming = new Set(
    state.activity
      .slice(0, 2)
      .filter((a) => a.kind === 'took')
      .map((a) => a.participantId),
  )
  const col = orientation === 'column'
  return (
    <div
      className={cn(
        col
          ? 'flex flex-col gap-1'
          : 'c-scroll-x -mx-1 flex items-start gap-1 overflow-x-auto px-1 pt-2',
      )}
      role={onSeat ? 'group' : undefined}
      aria-label={label}
      style={{
        ['--ring-offset' as string]: onTable
          ? 'var(--c-table)'
          : 'var(--c-paper)',
      }}
    >
      {derived.seats.map((seat) => {
        const brush = brushId === seat.participantId
        const status = seatStatus(seat)
        const inner = (
          <>
            <motion.span
              animate={brush ? { y: -5, scale: 1.08 } : { y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
              className="relative inline-flex"
              data-seat-src={seat.participantId}
            >
              <SeatAvatar
                seat={seat}
                index={seatIndex(derived.seats, seat.participantId)}
                size="md"
                ring={brush ? 'brush' : seat.joined ? 'joined' : 'away'}
                className={cn(
                  claiming.has(seat.participantId) && !brush && 'c-live-ring',
                )}
              />
              {brush && onSeat && (
                <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[var(--c-ink)] text-[var(--c-paper)] ring-2 ring-[var(--c-table-2)]">
                  <X className="size-3" strokeWidth={3} aria-hidden />
                </span>
              )}
              {status === 'paid' && (
                <span className="absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full bg-[var(--c-accent)] text-[var(--c-paper)]">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
              )}
              {status === 'pending' && (
                <span className="absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full border-2 border-dashed border-[var(--c-on-table)] bg-[var(--c-table)] text-[var(--c-on-table)]">
                  <Clock3 className="size-2.5" strokeWidth={2.5} aria-hidden />
                </span>
              )}
            </motion.span>
            <span
              className={cn(
                'min-w-0',
                col ? 'flex-1 text-left' : 'mt-1.5 w-full text-center',
              )}
            >
              <span
                className={cn(
                  'block truncate text-[11px] leading-tight',
                  brush
                    ? 'font-bold text-[var(--c-on-table)]'
                    : 'text-[var(--c-on-table)]',
                )}
              >
                {seat.participantId === meId ? 'Вие' : seat.name}
              </span>
              {col ? (
                <span className="block text-[11px] leading-tight text-[var(--c-on-table-muted)]">
                  {presenceText(seat)}
                </span>
              ) : (
                brush && (
                  <span className="block text-[10px] font-bold uppercase leading-tight text-[var(--c-accent)]">
                    четка
                  </span>
                )
              )}
            </span>
            {col && brush && (
              <span className="c-display rounded-full bg-[var(--c-accent)] px-2 py-0.5 text-[10px] font-bold text-[var(--c-btn-ink)]">
                четка
              </span>
            )}
          </>
        )
        const cls = cn(
          'flex shrink-0 items-center rounded-2xl transition-colors',
          col
            ? 'min-h-14 gap-3 px-2 py-1.5'
            : 'w-[68px] flex-col px-1 pb-1.5 pt-1',
          onSeat && 'hover:bg-[var(--c-table-2)]',
          brush && col && 'bg-[var(--c-table-2)]',
        )
        return onSeat ? (
          <button
            key={seat.participantId}
            type="button"
            className={cls}
            onClick={() => onSeat(seat.participantId)}
            aria-pressed={brush}
            aria-label={
              brush
                ? `${seat.name} е четката. Докоснете, за да спрете`
                : `Четка: ${seat.name}. ${presenceText(seat)}`
            }
          >
            {inner}
          </button>
        ) : (
          <div key={seat.participantId} className={cls}>
            {inner}
          </div>
        )
      })}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            'flex shrink-0 items-center rounded-2xl text-[var(--c-on-table)] hover:bg-[var(--c-table-2)]',
            col ? 'min-h-14 gap-3 px-2' : 'w-[68px] flex-col px-1 pb-1.5 pt-1',
          )}
        >
          <span className="grid size-11 place-items-center rounded-full border-2 border-dashed border-current">
            <Plus className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className={cn('text-[11px]', !col && 'mt-1.5')}>Добави</span>
        </button>
      )}
    </div>
  )
}

export type SeatStatus = 'host' | 'paid' | 'pending' | 'owes' | 'empty'

export function seatStatus(seat: SeatSummary): SeatStatus {
  if (seat.isHost) return 'host'
  if (seat.pendingCents > 0) return 'pending'
  if (seat.totals.owedCents > 0 && seat.remainingCents === 0) return 'paid'
  if (seat.remainingCents > 0) return 'owes'
  return 'empty'
}

function presenceText(seat: SeatSummary): string {
  const s = seatStatus(seat)
  if (s === 'host') return 'домакин'
  if (s === 'paid') return 'платил'
  if (s === 'pending') return 'чака потвърждение'
  return seat.joined
    ? `на масата, ${seat.claimedUnits} бр.`
    : 'не е отворил линка'
}

/* ---------------------------------------------------------------- ticker */

/**
 * Phone: no permanent ticker row. A new event slides in under the top bar,
 * stays a few seconds, then fades, so the receipt keeps the room.
 */
export function TransientTicker({ className }: { className?: string }) {
  const { state, derived } = useProto()
  const latest = state.activity.at(0)
  const [seenId, setSeenId] = useState(() => latest?.id)
  const visible = !!latest && latest.id !== seenId
  useEffect(() => {
    if (!visible) return
    const t = window.setTimeout(() => setSeenId(latest.id), 3800)
    return () => window.clearTimeout(t)
  }, [visible, latest])
  const seat =
    latest &&
    derived.seats.find((s) => s.participantId === latest.participantId)
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 top-full flex justify-center px-3 pt-1',
        className,
      )}
      aria-live="polite"
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            key={latest.id}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="flex max-w-full items-center gap-2 rounded-full bg-[var(--c-ink)] py-1 pl-1 pr-3 text-[11px] text-[var(--c-paper)] shadow-[0_10px_24px_-10px_var(--c-shadow)]"
          >
            {seat && (
              <SeatAvatar
                seat={seat}
                index={seatIndex(derived.seats, seat.participantId)}
                size="xs"
              />
            )}
            <span className="truncate">{latest.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Feed({ limit = 9 }: { limit?: number }) {
  const { state, derived } = useProto()
  const hydrated = useHydrated()
  const items = state.activity.slice(0, limit)
  return (
    <section aria-label="Какво става на масата">
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-on-table-muted)]">
        <span
          className="size-1.5 rounded-full bg-[var(--c-accent)]"
          aria-hidden
        />
        На живо
      </h2>
      {items.length === 0 ? (
        <p className="text-[12px] text-[var(--c-on-table-muted)]">
          Тук ще виждате кой какво взема, щом отворят линка.
        </p>
      ) : (
        <ol className="space-y-0.5">
          <AnimatePresence initial={false}>
            {items.map((a) => {
              const seat = derived.seats.find(
                (s) => s.participantId === a.participantId,
              )
              return (
                <motion.li
                  key={a.id}
                  layout="position"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className="flex items-start gap-2 py-1.5 text-[12px] leading-snug"
                >
                  {seat ? (
                    <SeatAvatar
                      seat={seat}
                      index={seatIndex(derived.seats, seat.participantId)}
                      size="xs"
                      className="mt-px"
                    />
                  ) : (
                    <span className="size-[22px] shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">{a.text}</span>
                  <span className="shrink-0 text-[11px] text-[var(--c-on-table-muted)]">
                    {hydrated ? clock(a.at) : ''}
                  </span>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  )
}

/* ----------------------------------------------------------------- slips */

/** One person's tear-off slip as the host sees it. */
export function HostSlip({
  seat,
  big,
  readOnly,
}: {
  seat: SeatSummary
  big?: boolean
  readOnly?: boolean
}) {
  const { derived, dispatch, state } = useProto()
  const [copied, copy] = useCopy()
  const status = seatStatus(seat)
  const owed = seat.totals.owedCents
  const remind = () =>
    void shareOrCopy({
      title: state.bill.restaurantName,
      text: `Здрасти, ${seat.name}! За ${state.bill.restaurantName || 'сметката'} остават ${formatMoney(seat.remainingCents)}. Отбележи и плати тук:`,
      url: `https://${BILL_URL}`,
    }).then((didCopy) => didCopy && copy('remind', 'x'))

  const actions = readOnly ? null : status === 'pending' ? (
    <button
      type="button"
      className="c-btn !min-h-11 !px-4 !text-[12px]"
      onClick={() =>
        dispatch({ type: 'confirmPayment', participantId: seat.participantId })
      }
    >
      <Check className="size-4" strokeWidth={2.25} aria-hidden />
      Потвърди {formatMoney(seat.pendingCents)}
    </button>
  ) : status === 'owes' && big ? (
    <>
      <button
        type="button"
        className="c-ghost !min-h-11 !px-3"
        aria-label={`Отбележи ${seat.name} като платил в брой`}
        onClick={() =>
          dispatch({ type: 'markPaid', participantId: seat.participantId })
        }
      >
        <Banknote className="size-4" strokeWidth={1.75} aria-hidden />В брой
      </button>
      <button
        type="button"
        className="c-ink-btn !min-h-11 !px-3"
        onClick={remind}
      >
        <Bell className="size-4" strokeWidth={1.75} aria-hidden />
        {copied === 'remind' ? 'Копирано' : 'Напомни'}
      </button>
    </>
  ) : status === 'paid' && big ? (
    <button
      type="button"
      className="min-h-11 px-1 text-[11px] text-[var(--c-ink-muted)] underline underline-offset-2"
      onClick={() =>
        dispatch({ type: 'undoPayment', participantId: seat.participantId })
      }
    >
      Отмени плащането
    </button>
  ) : null

  return (
    <div className={cn('py-3', big && 'py-4')}>
      <div className="flex items-center gap-3">
        <SeatAvatar
          seat={seat}
          index={seatIndex(derived.seats, seat.participantId)}
          size={big ? 'md' : 'sm'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-semibold">{seat.name}</span>
            {status === 'host' && (
              <span className="text-[11px] text-[var(--c-ink-muted)]">
                домакин
              </span>
            )}
          </div>
          <div className="text-[11px] leading-snug text-[var(--c-ink-muted)]">
            {status === 'pending'
              ? `отбеляза превод ${formatMoney(seat.pendingCents)}`
              : status === 'paid'
                ? `платени ${formatMoney(seat.totals.paidCents)}`
                : status === 'host'
                  ? `ваш дял ${formatMoney(owed)}`
                  : owed > 0
                    ? seat.claimedUnits > 0
                      ? `${seat.claimedUnits} бр., дял ${formatMoney(owed)}`
                      : `още нищо, бакшиш ${formatMoney(owed)}`
                    : 'още нищо не е отбелязал'}
          </div>
        </div>
        <div className="relative flex min-h-9 shrink-0 items-center justify-end">
          {status === 'owes' && (
            <span
              className={cn(
                'c-display font-bold',
                big ? 'text-[18px]' : 'text-[14px]',
              )}
            >
              {formatMoney(seat.remainingCents)}
            </span>
          )}
          {status === 'host' && (
            <span className="text-[12px] text-[var(--c-ink-muted)]">
              не дължи
            </span>
          )}
          <AnimatePresence initial={false}>
            {status === 'paid' && (
              <Stamp
                key="paid"
                kind="paid"
                className={big ? 'text-[16px]' : 'text-[12px]'}
              >
                Платено
              </Stamp>
            )}
            {status === 'pending' && (
              <Stamp
                key="wait"
                kind="wait"
                className={big ? 'text-[14px]' : 'text-[11px]'}
              >
                Чака
              </Stamp>
            )}
          </AnimatePresence>
        </div>
      </div>
      {actions && (
        <div className="mt-2 flex flex-wrap justify-end gap-1.5">{actions}</div>
      )}
    </div>
  )
}

/** Perforated edge, then the slips: each person a stub. */
export function SlipStack({
  big,
  readOnly,
  className,
}: {
  big?: boolean
  readOnly?: boolean
  className?: string
}) {
  const { derived } = useProto()
  const order = [...derived.seats].sort((a, b) => rank(a) - rank(b))
  return (
    <div className={className}>
      {order.map((seat) => (
        <div key={seat.participantId} className="c-slip -mt-px px-4 sm:px-6">
          <div className="c-perf -mx-4 sm:-mx-6" aria-hidden />
          <HostSlip seat={seat} big={big} readOnly={readOnly} />
        </div>
      ))}
    </div>
  )
}

function rank(s: SeatSummary): number {
  const status = seatStatus(s)
  return { pending: 0, owes: 1, empty: 2, paid: 3, host: 4 }[status]
}

/* ------------------------------------------------------------------ undo */

export interface UndoEntry {
  id: number
  text: string
  undo: () => void
}

export function useUndo(): [
  UndoEntry | null,
  (text: string, undo: () => void) => void,
  () => void,
] {
  const [entry, setEntry] = useState<UndoEntry | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const seq = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const push = useCallback((text: string, undo: () => void) => {
    seq.current += 1
    setEntry({ id: seq.current, text, undo })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setEntry(null), 5000)
  }, [])
  const clear = useCallback(() => setEntry(null), [])
  return [entry, push, clear]
}

/** Undo inside an existing bar (replaces its content for a few seconds). */
export function UndoRow({
  entry,
  onDone,
}: {
  entry: UndoEntry
  onDone: () => void
}) {
  return (
    <motion.div
      key={entry.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-12 items-center gap-2"
      role="status"
    >
      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
        {entry.text}
      </span>
      <button
        type="button"
        onClick={() => {
          entry.undo()
          onDone()
        }}
        className="c-ghost shrink-0"
      >
        <Undo2 className="size-4" strokeWidth={1.75} aria-hidden />
        Отмени
      </button>
    </motion.div>
  )
}
