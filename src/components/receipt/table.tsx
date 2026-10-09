import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckIcon, Clock3Icon, PlusIcon, Undo2Icon, XIcon } from 'lucide-react'
import { SeatAvatar, useSeatLookup } from '#/components/receipt/seats.tsx'
import type { Seat } from '#/components/receipt/seats.tsx'
import { Button } from '#/components/ui/button.tsx'
import { cn } from '#/lib/utils.ts'
import type { ActivityEvent } from '#/lib/bill-activity.ts'
import { seatPresenceLabel } from '../../../shared/live-receipt.ts'
import type {
  LiveReceiptSeat,
  SeatStatus,
} from '../../../shared/live-receipt.ts'

export interface RailSeat {
  seat: Seat
  /** A phone holds this seat right now. */
  joined: boolean
  status: SeatStatus
  /** One short line: „на масата, 3 бр.“, „чака потвърждение“. */
  presence: string
}

/** The receipt's seats as the rail draws them. */
export function toRailSeats(
  seats: LiveReceiptSeat[],
  seatOf: (id: string) => Seat | undefined,
): RailSeat[] {
  return seats.map((seat) => ({
    seat: seatOf(seat.id) ?? {
      id: seat.id,
      label: seat.name,
      initials: '?',
      hue: 0,
      isHost: false,
    },
    joined: seat.joined,
    status: seat.status,
    presence: seatPresenceLabel(seat),
  }))
}

/**
 * The people around the table. On the host phone the rail is also the brush
 * picker for painting lines.
 */
export function SeatsRail({
  seats,
  orientation = 'row',
  meId,
  brushId,
  liveIds,
  onSeat,
  onAdd,
  addLabel = 'Добави хора',
  label,
  onTable = true,
}: {
  seats: RailSeat[]
  orientation?: 'row' | 'column'
  /** The viewer's own seat, labelled „Вие“. */
  meId?: string | null
  brushId?: string | null
  /** Seats that just did something: they pulse. */
  liveIds?: Set<string>
  onSeat?: (id: string) => void
  onAdd?: () => void
  addLabel?: string
  label?: string
  /** Rendered on the table surface (vs on paper). */
  onTable?: boolean
}) {
  const column = orientation === 'column'
  return (
    <div
      className={cn(
        column
          ? 'flex flex-col gap-1'
          : 'scroll-x-quiet -mx-1 flex items-start gap-1 overflow-x-auto px-1 pt-2',
      )}
      // A label needs a role to be announced, picker or not.
      role={label || onSeat ? 'group' : undefined}
      aria-label={label}
      style={{
        ['--ring-offset' as string]: onTable ? 'var(--table)' : 'var(--paper)',
      }}
    >
      {seats.map(({ seat, joined, status, presence }) => {
        const brush = brushId === seat.id
        const name = seat.id === meId ? 'Вие' : seat.label
        const inner = (
          <>
            <motion.span
              animate={brush ? { y: -5, scale: 1.08 } : { y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 20 }}
              className="relative inline-flex"
              data-seat-src={seat.id}
            >
              <SeatAvatar
                seat={seat}
                size="md"
                ring={
                  brush ? 'brush' : joined || seat.isHost ? 'joined' : 'away'
                }
                className={cn(liveIds?.has(seat.id) && !brush && 'live-ring')}
              />
              {brush && onSeat ? (
                <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-on-table text-table ring-2 ring-table-2">
                  <XIcon className="size-3" strokeWidth={3} aria-hidden />
                </span>
              ) : null}
              {status === 'paid' ? (
                <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full bg-stamp text-paper">
                  <CheckIcon className="size-3" strokeWidth={3} aria-hidden />
                </span>
              ) : null}
              {status === 'pending' ? (
                <span className="absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full border-2 border-dashed border-on-table bg-table text-on-table">
                  <Clock3Icon
                    className="size-2.5"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </span>
              ) : null}
            </motion.span>
            <span
              className={cn(
                'min-w-0',
                column ? 'flex-1 text-left' : 'mt-1.5 w-full text-center',
              )}
            >
              <span
                className={cn(
                  'block truncate text-[11px] leading-tight text-on-table',
                  brush && 'font-bold',
                )}
              >
                {name}
              </span>
              {column ? (
                <span className="block text-[11px] leading-tight text-on-table-muted">
                  {presence}
                </span>
              ) : brush ? (
                <span className="block text-[10px] leading-tight font-bold text-stamp-ink uppercase">
                  избран
                </span>
              ) : null}
            </span>
            {column && brush ? (
              <span className="rounded-full bg-primary px-2 py-0.5 font-display text-[10px] font-bold text-primary-foreground">
                избран
              </span>
            ) : null}
          </>
        )
        const className = cn(
          'flex shrink-0 items-center rounded-2xl transition-colors',
          column
            ? 'min-h-14 gap-3 px-2 py-1.5'
            : 'w-[68px] flex-col px-1 pt-1 pb-1.5',
          onSeat && 'hover:bg-table-2',
          brush && column && 'bg-table-2',
        )
        return onSeat ? (
          <button
            key={seat.id}
            type="button"
            className={className}
            onClick={() => onSeat(seat.id)}
            aria-pressed={brush}
            aria-label={
              brush
                ? `Избран: ${seat.label}. Докоснете, за да спрете`
                : `Изберете ${seat.label}. ${presence}`
            }
          >
            {inner}
          </button>
        ) : (
          <div key={seat.id} className={className}>
            {inner}
          </div>
        )
      })}
      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            'flex shrink-0 items-center rounded-2xl text-on-table hover:bg-table-2',
            column
              ? 'min-h-14 gap-3 px-2'
              : 'w-[68px] flex-col px-1 pt-1 pb-1.5',
          )}
        >
          <span className="grid size-11 place-items-center rounded-full border-2 border-dashed border-current">
            <PlusIcon className="size-5" strokeWidth={1.75} aria-hidden />
          </span>
          <span className={cn('text-[11px]', !column && 'mt-1.5')}>
            {addLabel}
          </span>
        </button>
      ) : null}
    </div>
  )
}

const clockFormat = new Intl.DateTimeFormat('bg-BG', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Sofia',
})

/**
 * Phone: no permanent ticker row. A new event slides in under the top bar,
 * stays a few seconds, then fades, so the receipt keeps the room.
 */
export function TransientTicker({
  latest,
  className,
}: {
  latest: ActivityEvent | undefined
  className?: string
}) {
  const seatOf = useSeatLookup()
  // Mounting (e.g. coming back to На масата) is not news: start caught up.
  const [seenId, setSeenId] = useState<string | undefined>(() => latest?.id)
  const visible = !!latest && latest.id !== seenId
  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(() => setSeenId(latest.id), 3800)
    return () => window.clearTimeout(timer)
  }, [visible, latest])
  const seat = latest ? seatOf(latest.seatId) : undefined
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-x-0 top-full flex justify-center px-3 pt-1',
        className,
      )}
      aria-live="polite"
    >
      {/* One pill at a time: when claims come in quick succession the old
          pill clears out fast instead of piling up beside the new one. */}
      <AnimatePresence mode="wait" custom={visible}>
        {visible ? (
          <motion.div
            key={latest.id}
            custom={visible}
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit="exit"
            variants={{
              exit: (replaced: boolean) => ({
                opacity: 0,
                transition: { duration: replaced ? 0.1 : 0.4 },
              }),
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="flex max-w-full items-center gap-2 rounded-full bg-ink py-1 pr-3 pl-1 text-[11px] text-paper shadow-[0_10px_24px_-10px_var(--paper-shadow)]"
          >
            {seat ? <SeatAvatar seat={seat} size="xs" /> : null}
            <span className="min-w-0 truncate">{latest.text}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/** „На живо“: the last things that happened at the table. */
export function ActivityFeed({
  events,
  limit = 9,
  emptyText = 'Тук ще виждате кой какво взема, щом отворят линка.',
}: {
  events: ActivityEvent[]
  limit?: number
  emptyText?: string
}) {
  const seatOf = useSeatLookup()
  const items = events.slice(0, limit)
  return (
    <section aria-label="Какво става на масата">
      <h2 className="mb-2 flex items-center gap-2 font-sans text-[11px] font-semibold tracking-wide text-on-table-muted uppercase">
        <span className="size-1.5 rounded-full bg-stamp" aria-hidden />
        На живо
      </h2>
      {items.length === 0 ? (
        <p className="text-[12px] text-on-table-muted">{emptyText}</p>
      ) : (
        <ol className="space-y-0.5">
          <AnimatePresence initial={false}>
            {items.map((event) => {
              const seat = seatOf(event.seatId)
              return (
                <motion.li
                  key={event.id}
                  layout="position"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  className="flex items-start gap-2 py-1.5 text-[12px] leading-snug"
                >
                  {seat ? (
                    <SeatAvatar seat={seat} size="xs" className="mt-px" />
                  ) : (
                    <span className="size-[22px] shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">{event.text}</span>
                  <span className="shrink-0 text-[11px] text-on-table-muted">
                    {clockFormat.format(new Date(event.at))}
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

export interface UndoEntry {
  id: number
  text: string
  undo: () => void
}

/** A five-second undo for the last tap (paint a line, take a Unit). */
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
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          entry.undo()
          onDone()
        }}
      >
        <Undo2Icon className="size-4" strokeWidth={1.75} aria-hidden />
        Отмени
      </Button>
    </motion.div>
  )
}
