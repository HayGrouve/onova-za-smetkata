/** PROTOTYPE Direction C: guest phone. Same receipt, guest permissions; your slip is pinned at the bottom. */
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Plus,
  Scissors,
  UserPlus,
  X,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { useProto } from '../mock/store.tsx'
import { HOST_PAYOUT } from '../mock/data.ts'
import { GuestLineDrawer } from './drawers.tsx'
import { useFly } from './flight.tsx'
import {
  ClaimLine,
  Paper,
  ReceiptHeader,
  RestaurantTitle,
  Rule,
  Timeline,
  Totals,
} from './receipt.tsx'
import { Feed, SeatsRail, TransientTicker, UndoRow, useUndo } from './table.tsx'
import type { UndoEntry } from './table.tsx'
import { SeatAvatar, Stamp, formatMoney, seatIndex, useCopy } from './ui.tsx'

/* ================================================================= join */

export function GuestJoin() {
  const { state, derived, dispatch } = useProto()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [tried, setTried] = useState(false)
  const nameErr = tried && !name.trim() ? 'Напишете името си.' : null
  const final = state.bill.status === 'final'

  return (
    <div className="mx-auto w-full max-w-[480px] px-3 pb-24 pt-6 sm:pt-12">
      <Paper>
        <ReceiptHeader
          date={state.bill.date}
          title={<RestaurantTitle name={state.bill.restaurantName} />}
        >
          <p className="mt-2 text-[12px] leading-relaxed text-[var(--c-ink-muted)]">
            Даниел плати сметката. Изберете кой сте и отбележете какво сте яли и
            пили.
          </p>
        </ReceiptHeader>
        <Rule />
        {final ? (
          <p className="py-4 text-[12px]">
            Сметката е приключена. Ако дължите нещо, Даниел ще ви пише.
          </p>
        ) : (
          <section aria-labelledby="c-who">
            <h2 id="c-who" className="c-display text-[20px] font-bold">
              Кой сте вие?
            </h2>
            <ul className="mt-4 grid grid-cols-3 gap-2">
              {derived.seats.map((s) => {
                const taken = !s.isHost && s.joined
                const disabled = s.isHost || taken
                return (
                  <li key={s.participantId}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        dispatch({
                          type: 'pickSeat',
                          participantId: s.participantId,
                        })
                      }
                      className={cn(
                        'flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-1 py-2 transition-colors',
                        disabled
                          ? 'border-transparent'
                          : 'border-[var(--c-ink)] hover:bg-[var(--c-paper-2)] active:scale-[0.98]',
                      )}
                      aria-label={
                        disabled
                          ? `${s.name}, ${s.isHost ? 'домакин' : 'заето'}`
                          : `Аз съм ${s.name}`
                      }
                    >
                      <SeatAvatar
                        seat={s}
                        index={seatIndex(derived.seats, s.participantId)}
                        size="lg"
                        className={cn(disabled && 'opacity-40 grayscale')}
                      />
                      <span
                        className={cn(
                          'text-[13px] font-semibold',
                          disabled && 'text-[var(--c-ink-muted)]',
                        )}
                      >
                        {s.name}
                      </span>
                      {disabled && (
                        <span className="text-[10px] uppercase tracking-wide text-[var(--c-ink-muted)]">
                          {s.isHost ? 'домакин' : 'заето'}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
              {!adding && (
                <li>
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[var(--c-ink-muted)] px-1 py-2 hover:border-solid hover:border-[var(--c-ink)]"
                  >
                    <span className="grid size-14 place-items-center rounded-full border-2 border-dashed border-current">
                      <Plus className="size-6" strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="text-[13px] font-semibold">Няма ме</span>
                  </button>
                </li>
              )}
            </ul>
            <AnimatePresence initial={false}>
              {adding && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setTried(true)
                    if (name.trim()) dispatch({ type: 'joinAsNew', name })
                  }}
                >
                  <div className="mt-4 border-l-[3px] border-[var(--c-ink)] bg-[var(--c-paper-2)] p-3">
                    <label
                      htmlFor="c-guest-name"
                      className="text-[12px] font-semibold"
                    >
                      Как да ви запишем?
                    </label>
                    <input
                      id="c-guest-name"
                      className="c-input"
                      value={name}
                      autoFocus
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Вашето име"
                      aria-invalid={!!nameErr}
                      aria-describedby={
                        nameErr ? 'c-guest-name-err' : undefined
                      }
                    />
                    {nameErr && (
                      <p
                        id="c-guest-name-err"
                        className="mt-1 text-[11px] font-semibold"
                      >
                        {nameErr}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <button type="submit" className="c-ink-btn">
                        <UserPlus
                          className="size-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        Сядам на масата
                      </button>
                      <button
                        type="button"
                        className="min-h-11 px-3 text-[12px] underline underline-offset-2"
                        onClick={() => setAdding(false)}
                      >
                        Откажи
                      </button>
                    </div>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </section>
        )}
        <Rule />
        <div aria-hidden className="pointer-events-none select-none opacity-45">
          <ul>
            {derived.groups.slice(0, 5).map((g) => (
              <ClaimLine key={g.key} group={g} mode="readonly" print={false} />
            ))}
          </ul>
          <p className="pt-1 text-center text-[11px]">
            и още {Math.max(0, derived.groups.length - 5)} реда
          </p>
        </div>
      </Paper>
    </div>
  )
}

/* ================================================================ claim */

export function GuestClaim({ onPay }: { onPay: () => void }) {
  const { state, derived, dispatch, mySeatIds } = useProto()
  const fly = useFly()
  const me = state.guestSeatId!
  const [activeId, setActiveId] = useState(me)
  const actor = mySeatIds.includes(activeId) ? activeId : me
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [lineError, setLineError] = useState<{
    key: string
    text: string
  } | null>(null)
  const errTimer = useRef<number | undefined>(undefined)
  const [undo, pushUndo, clearUndo] = useUndo()
  const final = state.bill.status === 'final'
  const meSeat = derived.seats.find((s) => s.participantId === me)

  const take = (groupKey: string) => {
    const group = derived.groups.find((g) => g.key === groupKey)
    if (!group || final) return
    const view = derived.seatView(groupKey, actor)
    if (view.freeUnits.length === 0) {
      setLineError({
        key: groupKey,
        text: 'Всичко от реда е взето. Делихте ли? Задръжте реда.',
      })
      window.clearTimeout(errTimer.current)
      errTimer.current = window.setTimeout(() => setLineError(null), 2800)
      return
    }
    const unit = view.freeUnits[0]
    fly(actor, groupKey)
    dispatch({ type: 'takeUnit', groupKey, participantId: actor })
    const who = actor === me ? 'Взехте' : `За ${derived.labels[actor]}:`
    pushUndo(`${who} ${group.name}`, () =>
      dispatch({ type: 'setUnitMembers', unit, participantIds: [] }),
    )
  }

  const slip = (
    <MySlip
      activeId={actor}
      setActiveId={setActiveId}
      onTear={onPay}
      undo={undo}
      clearUndo={clearUndo}
    />
  )

  return (
    <div className="min-h-[100dvh]">
      <div className="sticky top-0 z-30 bg-[var(--c-table)]/95 backdrop-blur-sm">
        <div className="relative mx-auto flex max-w-[1180px] items-center gap-3 px-4 sm:px-6">
          <Timeline
            phase="table"
            final={final}
            className="min-w-0 flex-1 lg:max-w-[460px]"
          />
          {!final && <TransientTicker className="lg:hidden" />}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1180px] items-start gap-6 px-3 pb-[250px] pt-2 sm:px-6 md:grid-cols-[minmax(0,1fr)_320px] md:pb-24 lg:grid-cols-[240px_minmax(0,460px)_320px] lg:justify-center lg:gap-10 lg:pt-8">
        <aside className="sticky top-20 hidden space-y-6 lg:block">
          <section className="space-y-3" aria-label="Масата">
            <h2 className="c-display text-[14px] font-bold">Масата</h2>
            <SeatsRail orientation="column" meId={me} />
          </section>
          <Feed />
        </aside>

        <main className="min-w-0">
          <div className="mb-2 lg:hidden">
            <SeatsRail label="Хората на масата" meId={me} />
          </div>
          <Paper>
            <ReceiptHeader
              date={state.bill.date}
              title={<RestaurantTitle name={state.bill.restaurantName} />}
            >
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px] text-[var(--c-ink-muted)]">
                <span>
                  Вие сте <b className="text-[var(--c-ink)]">{meSeat?.name}</b>.
                </span>
                <button
                  type="button"
                  className="min-h-11 underline underline-offset-2"
                  onClick={() => dispatch({ type: 'leaveSeat' })}
                >
                  Не сте {meSeat?.name}?
                </button>
              </p>
              <p className="text-[12px] leading-relaxed">
                Докоснете ред, за да вземете бройка. Задръжте го за делене и
                брой.
              </p>
            </ReceiptHeader>
            <Rule />
            <ul>
              {derived.groups.map((g, i) => (
                <div key={g.key}>
                  <ClaimLine
                    group={g}
                    index={i}
                    print={false}
                    mode={final ? 'readonly' : 'claim'}
                    highlightIds={mySeatIds}
                    open={openKey === g.key}
                    error={lineError?.key === g.key ? lineError.text : null}
                    onTap={() => take(g.key)}
                    onMore={() => setOpenKey(openKey === g.key ? null : g.key)}
                    onReleaseUnit={(unit, seatId) =>
                      dispatch({
                        type: 'leaveUnit',
                        unit,
                        participantId: seatId,
                      })
                    }
                  />
                  <AnimatePresence initial={false}>
                    {openKey === g.key && !final && (
                      <GuestLineDrawer
                        key="d"
                        group={g}
                        actorId={actor}
                        onClose={() => setOpenKey(null)}
                        onTake={() => take(g.key)}
                      />
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </ul>
            <Rule />
            <Totals>
              <div className="flex items-baseline text-[var(--c-ink-muted)]">
                <span>Неотбелязани от никого</span>
                <span className="c-leader" />
                <span>
                  {derived.unclaimedUnits} бр.,{' '}
                  {formatMoney(derived.unclaimedCents)}
                </span>
              </div>
            </Totals>
          </Paper>
        </main>

        <aside className="sticky top-20 hidden space-y-5 md:block">
          {slip}
          <div className="lg:hidden">
            <Feed limit={5} />
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-[var(--c-table)] from-60% to-transparent pt-4 md:hidden">
        {slip}
      </div>
    </div>
  )
}

/** The guest's own tear-off slip: running total, covered seats, tear to pay. */
function MySlip({
  activeId,
  setActiveId,
  onTear,
  undo,
  clearUndo,
}: {
  activeId: string
  setActiveId: (id: string) => void
  onTear: () => void
  undo: UndoEntry | null
  clearUndo: () => void
}) {
  const { state, derived, dispatch, mySeatIds } = useProto()
  const reduce = useReducedMotion()
  const [picking, setPicking] = useState(false)
  const [tearing, setTearing] = useState(false)
  const me = state.guestSeatId!
  const mine = derived.seats.filter((s) => mySeatIds.includes(s.participantId))
  const owed = mine.reduce((s, x) => s + x.totals.owedCents, 0)
  const remaining = mine.reduce((s, x) => s + x.remainingCents, 0)
  const pending = mine.reduce((s, x) => s + x.pendingCents, 0)
  const unitsCount = mine.reduce((s, x) => s + x.claimedUnits, 0)
  const coverable = derived.guests.filter(
    (g) => g.participantId !== me && (!g.joined || g.phoneSeatId === me),
  )
  const settled = owed > 0 && remaining === 0

  const tear = () => {
    if (reduce) return onTear()
    setTearing(true)
  }

  return (
    <div className="space-y-2 px-3 pb-[max(10px,env(safe-area-inset-bottom))] md:px-0 md:pb-0">
      <AnimatePresence initial={false}>
        {picking && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="rounded-[22px] bg-[var(--c-table-2)] p-3 text-[var(--c-on-table)] shadow-[0_12px_30px_-12px_var(--c-shadow)]"
          >
            <div className="flex items-center justify-between">
              <p className="c-display text-[13px] font-bold">Плащам и за...</p>
              <button
                type="button"
                onClick={() => setPicking(false)}
                className="-mr-1 grid size-11 place-items-center"
                aria-label="Затвори"
              >
                <X className="size-4" strokeWidth={1.75} aria-hidden />
              </button>
            </div>
            <p className="mb-2 text-[11px] leading-snug text-[var(--c-on-table-muted)]">
              Отбелязвате и плащате вместо тях. Хората с телефон на масата не се
              показват.
            </p>
            {coverable.length === 0 ? (
              <p className="text-[12px]">Всички останали отбелязват сами.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {coverable.map((g) => {
                  const on = mySeatIds.includes(g.participantId)
                  return (
                    <button
                      key={g.participantId}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        dispatch({
                          type: 'setCovered',
                          participantIds: on
                            ? state.coveredSeatIds.filter(
                                (x) => x !== g.participantId,
                              )
                            : [...state.coveredSeatIds, g.participantId],
                        })
                      }
                      className={cn(
                        'flex min-h-11 items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-3 text-[12px]',
                        on
                          ? 'border-[var(--c-on-table)] font-semibold'
                          : 'border-transparent bg-[var(--c-table)]',
                      )}
                    >
                      <SeatAvatar
                        seat={g}
                        index={seatIndex(derived.seats, g.participantId)}
                        size="sm"
                      />
                      {g.name}
                      {on && (
                        <Check
                          className="size-3.5"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={
          tearing
            ? { y: -40, x: 24, rotate: -6, opacity: 0 }
            : { y: 0, x: 0, rotate: 0, opacity: 1 }
        }
        transition={
          tearing
            ? { duration: 0.45, ease: [0.5, 0, 0.7, 0.4] }
            : { duration: 0 }
        }
        onAnimationComplete={() => {
          if (tearing) {
            setTearing(false)
            onTear()
          }
        }}
        className="c-paper-shadow origin-top-left"
      >
        <div className="c-slip px-4 pb-4 md:pb-5">
          <div
            className="c-perf -mx-4 mb-1 flex items-center justify-center"
            aria-hidden
          >
            <Scissors
              className="relative z-10 size-3.5 -translate-y-[1px] bg-[var(--c-paper)] px-0.5 text-[var(--c-ink-muted)]"
              strokeWidth={1.75}
            />
          </div>
          {mine.length > 1 && (
            <div
              className="mb-2 flex items-center gap-1.5"
              role="group"
              aria-label="Отбелязвате за"
            >
              <span className="text-[11px] text-[var(--c-ink-muted)]">
                Отбелязвам за
              </span>
              {mine.map((s) => (
                <button
                  key={s.participantId}
                  type="button"
                  aria-pressed={activeId === s.participantId}
                  onClick={() => setActiveId(s.participantId)}
                  className={cn(
                    'flex min-h-11 items-center gap-1 rounded-full py-1 pl-1 pr-2.5 text-[12px]',
                    activeId === s.participantId
                      ? 'bg-[var(--c-ink)] font-semibold text-[var(--c-paper)]'
                      : 'hover:bg-[var(--c-paper-2)]',
                  )}
                >
                  <SeatAvatar
                    seat={s}
                    index={seatIndex(derived.seats, s.participantId)}
                    size="xs"
                  />
                  {s.participantId === me ? 'мен' : s.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <span data-seat-src={activeId} className="inline-flex">
              <SeatAvatar
                seat={derived.seats.find((s) => s.participantId === activeId)!}
                index={seatIndex(derived.seats, activeId)}
                size="md"
              />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <span className="block text-[11px] text-[var(--c-ink-muted)]">
                {mine.length > 1
                  ? `Вашият дял с ${mine.length - 1} души`
                  : 'Вашият дял'}
                , {unitsCount} бр.
              </span>
              <motion.span
                key={owed}
                initial={{ y: -6, opacity: 0.4 }}
                animate={{ y: 0, opacity: 1 }}
                className="c-display block text-[26px] font-bold"
              >
                {formatMoney(owed)}
              </motion.span>
            </div>
            <div className="relative">
              <AnimatePresence initial={false}>
                {settled ? (
                  <Stamp key="p" kind="paid" className="text-[14px]">
                    Платено
                  </Stamp>
                ) : pending > 0 ? (
                  <Stamp key="w" kind="wait" className="text-[13px]">
                    Чака
                  </Stamp>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
          {undo ? (
            <div className="mt-3">
              <UndoRow entry={undo} onDone={clearUndo} />
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPicking((v) => !v)}
                className="c-ghost size-12 shrink-0 !px-0 text-[var(--c-ink)] md:size-auto md:!px-3"
                aria-expanded={picking}
                aria-label="Плащам и за някого"
              >
                <UserPlus className="size-4" strokeWidth={1.75} aria-hidden />
                <span className="hidden md:inline">Плащам и за...</span>
              </button>
              <button
                type="button"
                className="c-btn min-w-0 flex-1"
                disabled={owed === 0}
                onClick={tear}
              >
                <Scissors className="size-4" strokeWidth={1.75} aria-hidden />
                {settled || pending > 0 ? 'Виж плащането' : 'Откъсни и плати'}
              </button>
            </div>
          )}
          {owed === 0 && (
            <p className="mt-2 text-[11px] text-[var(--c-ink-muted)]">
              Докоснете ред от бележката, за да започнете.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  )
}

/* ================================================================== pay */

export function GuestPay({ onBack }: { onBack: () => void }) {
  const { state, derived, dispatch, mySeatIds } = useProto()
  const [copied, copy] = useCopy()
  const [showLines, setShowLines] = useState(false)
  const mine = derived.seats.filter((s) => mySeatIds.includes(s.participantId))
  const owed = mine.reduce((s, x) => s + x.totals.owedCents, 0)
  const remaining = mine.reduce((s, x) => s + x.remainingCents, 0)
  const pending = mine.reduce((s, x) => s + x.pendingCents, 0)
  const settled = owed > 0 && remaining === 0
  const toPay = mine.filter((s) => s.remainingCents > 0 && s.pendingCents === 0)
  const names = mine
    .map((s) => (s.participantId === state.guestSeatId ? 'вас' : s.name))
    .join(' и ')
  const note = `${state.bill.restaurantName} ${mine.map((s) => s.name).join(', ')}`
  const revolut = `https://revolut.me/${HOST_PAYOUT.revolutTag}?amount=${(remaining / 100).toFixed(2)}&currency=EUR&note=${encodeURIComponent(note)}`

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-[460px] px-3 pb-40 pt-3 sm:pt-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[12px] font-semibold hover:bg-[var(--c-table-2)]"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
        Обратно към бележката
      </button>

      <motion.div
        initial={{ y: 70, rotate: 4, opacity: 0 }}
        animate={{ y: 0, rotate: -1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 20 }}
        className="c-paper-shadow"
      >
        <div className="c-stub relative px-5 pb-6 pt-5">
          <div className="flex items-baseline justify-between text-[11px] text-[var(--c-ink-muted)]">
            <span className="truncate">{state.bill.restaurantName}</span>
            <span>за {names}</span>
          </div>
          <div className="c-perf -mx-5 my-2" aria-hidden />
          <p className="text-[12px] text-[var(--c-ink-muted)]">
            {settled ? 'Платихте' : pending > 0 ? 'Преведохте' : 'За плащане'}
          </p>
          <p className="c-display mt-1 text-[48px] font-extrabold leading-none tracking-[-0.03em] sm:text-[56px]">
            {formatMoney(settled ? owed : pending > 0 ? pending : remaining)}
          </p>
          <div className="pointer-events-none absolute right-4 top-11">
            <AnimatePresence initial={false}>
              {settled ? (
                <Stamp key="p" kind="paid" className="text-[22px]">
                  Платено
                </Stamp>
              ) : pending > 0 ? (
                <Stamp key="w" kind="wait" className="text-[18px]">
                  Чака
                </Stamp>
              ) : null}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => setShowLines((v) => !v)}
            aria-expanded={showLines}
            className="mt-3 flex min-h-11 items-center gap-1 text-[12px] font-semibold"
          >
            Какво плащате
            <ChevronDown
              className={cn(
                'size-4 transition-transform',
                showLines && 'rotate-180',
              )}
              strokeWidth={1.75}
              aria-hidden
            />
          </button>
          <AnimatePresence initial={false}>
            {showLines && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                {mine.map((s) => {
                  const view = derived.shareView(s.participantId)
                  return (
                    <div key={s.participantId} className="pb-2 text-[12px]">
                      {mine.length > 1 && (
                        <p className="pt-1 font-semibold">{s.name}</p>
                      )}
                      {view.lines.map((l) => (
                        <div key={l.key} className="flex items-baseline">
                          <span className="min-w-0">
                            {l.label}
                            {(l.unitsText || l.sharedText) && (
                              <span className="text-[var(--c-ink-muted)]">
                                {' '}
                                (
                                {[l.unitsText, l.sharedText]
                                  .filter(Boolean)
                                  .join(', ')}
                                )
                              </span>
                            )}
                          </span>
                          <span className="c-leader" />
                          <span>{formatMoney(l.amountCents)}</span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {derived.unclaimedUnits > 0 && !settled && (
            <p className="mt-2 flex items-start gap-2 text-[11px] leading-snug">
              <AlertTriangle
                className="mt-px size-3.5 shrink-0 text-[var(--c-accent)]"
                strokeWidth={2}
                aria-hidden
              />
              На масата има още {derived.unclaimedUnits} неотбелязани бройки.
              Ако Даниел ги раздели, сумата ви ще се промени.
            </p>
          )}

          <div className="c-perf -mx-5 my-3" aria-hidden />

          {settled ? (
            <div className="space-y-3 text-[12px]">
              <p className="leading-relaxed">
                Даниел потвърди превода. Сметката ви е чиста, можете да
                затворите страницата.
              </p>
              <button type="button" className="c-ghost w-full" onClick={onBack}>
                Обратно към бележката
              </button>
            </div>
          ) : pending > 0 ? (
            <div className="space-y-2 text-[12px]">
              <p className="leading-relaxed">
                Даниел ще потвърди, когато види превода. Тук ще се появи печат
                „Платено“.
              </p>
              <button
                type="button"
                className="min-h-11 text-[12px] underline underline-offset-2"
                onClick={() =>
                  dispatch({ type: 'cancelReport', participantIds: mySeatIds })
                }
              >
                Още не съм превел, отмени
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <a
                href={revolut}
                target="_blank"
                rel="noreferrer"
                className="c-btn w-full !min-h-14 !text-[15px]"
              >
                Плати с Revolut
              </a>
              <div>
                <p className="text-[11px] text-[var(--c-ink-muted)]">
                  или по банков път на {HOST_PAYOUT.holder}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 break-all text-[13px] font-semibold">
                    {HOST_PAYOUT.iban}
                  </span>
                  <button
                    type="button"
                    className="c-ghost shrink-0 min-w-[112px]"
                    onClick={() =>
                      copy('iban', HOST_PAYOUT.iban.replace(/\s/g, ''))
                    }
                    aria-live="polite"
                  >
                    {copied === 'iban' ? (
                      <>
                        <Check className="size-4" strokeWidth={2} aria-hidden />
                        Копиран
                      </>
                    ) : (
                      <>
                        <Copy
                          className="size-4"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        IBAN
                      </>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="c-ink-btn w-full !min-h-12"
                onClick={() =>
                  dispatch({
                    type: 'reportPaid',
                    participantIds: toPay.map((s) => s.participantId),
                  })
                }
              >
                <Check className="size-4" strokeWidth={2} aria-hidden />
                Платих
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
