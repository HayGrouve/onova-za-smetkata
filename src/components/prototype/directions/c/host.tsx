/** PROTOTYPE Direction C: host phone. A shelf of receipts, then one living receipt per bill. */
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ChevronDown,
  Lock,
  Plus,
  Split,
} from 'lucide-react'
import { cn } from '#/lib/utils.ts'
import { useProto } from '../mock/store.tsx'
import type { MockHomeBill } from '../mock/data.ts'
import { HOME_BILLS } from '../mock/data.ts'
import { AssembleLines, PeopleTray, TipPicker } from './assemble.tsx'
import { HostUnitDrawer } from './drawers.tsx'
import { useFly } from './flight.tsx'
import {
  ClaimLine,
  LinkStub,
  Paper,
  ReceiptHeader,
  RestaurantTitle,
  Rule,
  Timeline,
  Totals,
} from './receipt.tsx'
import type { Phase } from './receipt.tsx'
import {
  Feed,
  HostSlip,
  SeatsRail,
  SlipStack,
  TransientTicker,
  UndoRow,
  seatStatus,
  useUndo,
} from './table.tsx'
import type { UndoEntry } from './table.tsx'
import {
  BILL_URL,
  SeatAvatar,
  useHydrated,
  formatMoney,
  seatIndex,
  shareOrCopy,
  useCopy,
} from './ui.tsx'

/* ================================================================ shelf */

export function HostShelf({
  onOpen,
  onNew,
}: {
  onOpen: () => void
  onNew: () => void
}) {
  const { derived, state } = useProto()
  const live = state.bill
  const otherOut = HOME_BILLS.reduce((s, b) => s + b.outstandingCents, 0)
  const out = derived.outstandingCents + otherOut
  const phaseLabel =
    live.status === 'final'
      ? 'Приключена'
      : live.items.length === 0
        ? 'Сглобяване'
        : derived.unclaimedUnits > 0
          ? 'На масата'
          : 'Разплащане'

  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 pb-32 pt-5 sm:px-6 lg:pt-10">
      <header className="flex items-center justify-between gap-3">
        <span className="c-display text-[13px] font-bold">
          Онова за сметката
        </span>
        <span className="flex items-center gap-2 text-[12px] text-[var(--c-on-table-muted)]">
          Даниел
          <SeatAvatar
            seat={{ initial: 'Д', name: 'Даниел' }}
            index={0}
            size="sm"
          />
        </span>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-16">
        <section aria-label="Текуща сметка">
          <p className="text-[12px] text-[var(--c-on-table-muted)]">
            Навън са общо
          </p>
          <p className="c-display mt-1 text-[40px] font-bold leading-none sm:text-[48px]">
            {formatMoney(out)}
          </p>
          <p className="mt-2 max-w-[36ch] text-[12px] leading-relaxed text-[var(--c-on-table-muted)]">
            {derived.pendingCents > 0
              ? `${formatMoney(derived.pendingCents)} чакат вашето потвърждение.`
              : 'Никой не чака потвърждение.'}
          </p>

          {/* The live receipt on top of a stack. */}
          <div className="relative mt-8">
            <div
              aria-hidden
              className="absolute inset-x-3 -bottom-3 top-3 rotate-[2.2deg] bg-[var(--c-table-3)]"
            />
            <div
              aria-hidden
              className="absolute inset-x-1 -bottom-1.5 top-1.5 -rotate-[1.4deg] bg-[var(--c-table-2)]"
            />
            <motion.button
              type="button"
              onClick={onOpen}
              whileTap={{ scale: 0.985 }}
              className="relative block w-full -rotate-[0.6deg] text-left"
              aria-label={`Отвори ${live.restaurantName || 'новата сметка'}`}
            >
              <Paper>
                <ReceiptHeader
                  date={live.date}
                  title={<RestaurantTitle name={live.restaurantName} />}
                />
                <div className="mt-3 flex items-center gap-2 text-[11px]">
                  <span className="c-display rounded-full bg-[var(--c-ink)] px-2.5 py-1 font-bold text-[var(--c-paper)]">
                    {phaseLabel}
                  </span>
                  <span className="text-[var(--c-ink-muted)]">
                    {derived.groups.length} реда, {derived.seats.length} души
                  </span>
                </div>
                <Rule />
                <div className="space-y-1 text-[12px]">
                  <Row
                    label="Общо"
                    value={formatMoney(
                      derived.subtotalCents + derived.tipCents,
                    )}
                  />
                  <Row
                    label="Неразпределени"
                    value={`${derived.unclaimedUnits} бр., ${formatMoney(derived.unclaimedCents)}`}
                  />
                  <Row
                    label="Събрани"
                    value={formatMoney(derived.collectedCents)}
                  />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div className="flex flex-wrap gap-1">
                    {derived.seats.map((s) => (
                      <SeatAvatar
                        key={s.participantId}
                        seat={s}
                        index={seatIndex(derived.seats, s.participantId)}
                        size="sm"
                        className="ring-2 ring-[var(--c-paper)]"
                      />
                    ))}
                  </div>
                  <div className="text-right">
                    <span className="block text-[11px] text-[var(--c-ink-muted)]">
                      Остават
                    </span>
                    <span className="c-display text-[22px] font-bold">
                      {formatMoney(derived.outstandingCents)}
                    </span>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-end gap-1 text-[12px] font-semibold">
                  Отвори сметката{' '}
                  <ArrowRight
                    className="size-4"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </div>
              </Paper>
            </motion.button>
          </div>

          <button
            type="button"
            className="c-btn mt-8 w-full sm:w-auto"
            onClick={onNew}
          >
            <Plus className="size-4" strokeWidth={2} aria-hidden />
            Нова сметка
          </button>
        </section>

        <section aria-label="Други сметки">
          <h2 className="c-display mb-4 text-[15px] font-bold">
            Предишни бележки
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:gap-5">
            {HOME_BILLS.map((b, i) => (
              <ShelfStub key={b._id} bill={b} tilt={i % 2 === 0 ? -0.8 : 0.7} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline">
      <span>{label}</span>
      <span className="c-leader" />
      <span className="font-semibold">{value}</span>
    </div>
  )
}

function ShelfStub({ bill, tilt }: { bill: MockHomeBill; tilt: number }) {
  const [copied, copy] = useCopy()
  const hydrated = useHydrated()
  const d = hydrated
    ? new Date(bill.date).toLocaleDateString('bg-BG', {
        day: '2-digit',
        month: 'short',
      })
    : ''
  const owes = bill.outstandingCents > 0
  const draft = bill.status === 'draft' && !owes
  return (
    <li className="list-none" style={{ rotate: `${tilt}deg` }}>
      <div className="c-paper-shadow">
        <div className="c-stub relative overflow-hidden px-4 py-4">
          <div className="flex items-baseline justify-between gap-2 text-[11px] text-[var(--c-ink-muted)]">
            <span suppressHydrationWarning>{d}</span>
            <span>{formatMoney(bill.totalCents)}</span>
          </div>
          <p
            className={cn(
              'c-display mt-1 truncate text-[15px] font-bold uppercase',
              !bill.restaurantName && 'italic text-[var(--c-ink-muted)]',
            )}
          >
            {bill.restaurantName ?? 'Без име'}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-snug text-[var(--c-ink-muted)]">
              {draft
                ? `${bill.unassignedUnits} неразпределени, без хора`
                : `${bill.paidGuestCount} от ${bill.guestCount} платили`}
            </p>
            {owes ? (
              <span className="c-stamp c-stamp-wait inline-block shrink-0 text-[10px]">
                Дължат {formatMoney(bill.outstandingCents)}
              </span>
            ) : draft ? (
              <span className="c-stamp c-stamp-wait inline-block shrink-0 text-[10px]">
                Чернова
              </span>
            ) : (
              <span className="c-stamp inline-block shrink-0 text-[11px]">
                Приключена
              </span>
            )}
          </div>
          {owes && (
            <>
              <ul className="mt-2 space-y-0.5 text-[12px]">
                {bill.debtors.map((x) => (
                  <li key={x.name} className="flex items-baseline">
                    <span>{x.name}</span>
                    <span className="c-leader" />
                    <span className="font-semibold">
                      {formatMoney(x.cents)}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="c-ink-btn mt-3"
                onClick={() =>
                  void shareOrCopy({
                    title: bill.restaurantName ?? 'Сметка',
                    text: `Напомняне за ${bill.restaurantName}: ${bill.debtors.map((x) => `${x.name} ${formatMoney(x.cents)}`).join(', ')}.`,
                    url: `https://${BILL_URL}`,
                  }).then((didCopy) => didCopy && copy('r', 'x'))
                }
              >
                <Bell className="size-4" strokeWidth={1.75} aria-hidden />
                {copied ? 'Копирано' : 'Напомни на двамата'}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  )
}

/* ============================================================ the bill */

export function HostBill({
  phase,
  setPhase,
  onBack,
  printing,
}: {
  phase: Phase
  setPhase: (p: Phase) => void
  onBack: () => void
  /** Fresh receipt: animate it printing out. */
  printing: boolean
}) {
  const { state, derived, dispatch } = useProto()
  const fly = useFly()
  const [brushId, setBrushId] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [lineError, setLineError] = useState<{
    key: string
    text: string
  } | null>(null)
  const errTimer = useRef<number | undefined>(undefined)
  const [showPeople, setShowPeople] = useState(false)
  const [undo, pushUndo, clearUndo] = useUndo()
  const final = state.bill.status === 'final'
  const brush = derived.seats.find((s) => s.participantId === brushId) ?? null

  const flashError = (key: string, text: string) => {
    setLineError({ key, text })
    window.clearTimeout(errTimer.current)
    errTimer.current = window.setTimeout(() => setLineError(null), 2800)
  }

  const paint = (groupKey: string) => {
    const group = derived.groups.find((g) => g.key === groupKey)
    if (!group) return
    if (!brush) {
      setOpenKey((k) => (k === groupKey ? null : groupKey))
      return
    }
    const free = derived.seatView(groupKey, brush.participantId).freeUnits
    if (free.length === 0) {
      flashError(
        groupKey,
        'Всичко от реда е взето. Задръжте реда, за да разделите бройка.',
      )
      return
    }
    const unit = free[0]
    fly(brush.participantId, groupKey)
    dispatch({ type: 'takeUnit', groupKey, participantId: brush.participantId })
    pushUndo(`${brush.name} взе ${group.name}`, () =>
      dispatch({ type: 'setUnitMembers', unit, participantIds: [] }),
    )
  }

  const blockers: string[] = []
  if (!state.bill.restaurantName.trim())
    blockers.push('Въведете име на заведението.')
  if (state.bill.items.length === 0) blockers.push('Добавете поне един ред.')
  if (derived.guests.length === 0) blockers.push('Добавете поне един човек.')

  const lines =
    phase === 'assemble' && !final ? (
      <AssembleLines />
    ) : (
      <LineList
        phase={final ? 'final' : phase}
        brushId={brushId}
        openKey={openKey}
        setOpenKey={setOpenKey}
        onPaint={paint}
        lineError={lineError}
        print={printing}
      />
    )

  const receipt = (
    <motion.div
      initial={printing ? { y: -60, clipPath: 'inset(0 0 100% 0)' } : false}
      animate={{ y: 0, clipPath: 'inset(0 0 -10% 0)' }}
      transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
      className="relative"
    >
      <div className="c-paper-shadow">
        <div className="c-paper-top c-thermal relative px-4 pb-4 sm:px-6">
          <ReceiptHeader
            date={state.bill.date}
            title={
              phase === 'assemble' && !final ? (
                <RestaurantInput />
              ) : (
                <RestaurantTitle name={state.bill.restaurantName} />
              )
            }
          >
            {phase !== 'assemble' && !final && <LinkStub />}
          </ReceiptHeader>

          <Rule />
          {lines}
          <Rule />
          {phase === 'assemble' && !final && <TipPicker />}
          <Totals />
          <AnimatePresence>
            {final && (
              <motion.div
                initial={{ scale: 1.6, rotate: -18, opacity: 0 }}
                animate={{ scale: 1, rotate: -10, opacity: 0.9 }}
                transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                className="pointer-events-none absolute inset-x-0 top-24 flex justify-center"
              >
                <span className="c-stamp !rotate-0 bg-[oklch(0.985_0.003_95/0.5)] px-4 text-[30px] sm:text-[36px]">
                  Приключена
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Slips continue the paper on phones; desktop shows them in their own column. */}
        <div
          className={cn(
            phase === 'assemble' && !final ? 'hidden' : 'md:hidden',
          )}
        >
          <SlipStack big={phase === 'settle' || final} readOnly={final} />
        </div>
        <div className="c-paper-end" aria-hidden />
      </div>
    </motion.div>
  )

  return (
    <div className="min-h-[100dvh]">
      {/* top bar */}
      <div className="sticky top-0 z-30 bg-[var(--c-table)]/95 backdrop-blur-sm">
        <div className="relative mx-auto flex max-w-[1180px] items-center gap-2 px-2 sm:px-6">
          <button
            type="button"
            onClick={onBack}
            aria-label="Сметки"
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-2 text-[12px] font-semibold hover:bg-[var(--c-table-2)]"
          >
            <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden />
            <span className="hidden sm:inline">Сметки</span>
          </button>
          <Timeline
            phase={phase}
            final={final}
            onPhase={final ? undefined : setPhase}
            className="min-w-0 flex-1 lg:max-w-[460px]"
          />
        </div>
        {phase !== 'assemble' && !final && (
          <TransientTicker className="lg:hidden" />
        )}
      </div>

      <div
        className={cn(
          'mx-auto grid max-w-[1180px] items-start gap-6 px-3 pt-3 sm:px-6',
          'md:grid-cols-[minmax(0,1fr)_300px] lg:grid-cols-[240px_minmax(0,460px)_300px] lg:justify-center lg:gap-10 lg:pt-8',
          'pb-[230px] md:pb-24',
        )}
      >
        {/* left: the table (desktop) */}
        <aside className="sticky top-20 hidden space-y-6 lg:block">
          <TableColumn
            phase={phase}
            final={final}
            brushId={brushId}
            setBrushId={setBrushId}
            showPeople={showPeople}
            setShowPeople={setShowPeople}
          />
          {phase !== 'assemble' && <Feed />}
        </aside>

        <main className="min-w-0">{receipt}</main>

        {/* right: slips and actions (tablet + desktop) */}
        <aside className="sticky top-20 hidden space-y-5 md:block">
          <div className="lg:hidden">
            <TableColumn
              phase={phase}
              final={final}
              brushId={brushId}
              setBrushId={setBrushId}
              showPeople={showPeople}
              setShowPeople={setShowPeople}
            />
          </div>
          <PhaseActions
            phase={phase}
            final={final}
            blockers={blockers}
            setPhase={setPhase}
            undo={undo}
            clearUndo={clearUndo}
            onBack={onBack}
          />
          {phase !== 'assemble' && (
            <div className="space-y-3">
              {[...derived.seats]
                .sort((a, b) => slipRank(a) - slipRank(b))
                .map((seat) => (
                  <div key={seat.participantId} className="c-paper-shadow">
                    <div className="c-stub px-4">
                      <HostSlip
                        seat={seat}
                        big={phase === 'settle'}
                        readOnly={final}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
          <div className="lg:hidden">
            {phase !== 'assemble' && <Feed limit={5} />}
          </div>
        </aside>
      </div>

      {/* phone dock */}
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden">
        <div className="space-y-2 rounded-t-[26px] bg-[var(--c-table-2)] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_40px_-20px_var(--c-shadow)]">
          {phase === 'assemble' && !final && showPeople && (
            <PeopleTray onClose={() => setShowPeople(false)} />
          )}
          {(phase === 'table' || phase === 'assemble') && !final && (
            <SeatsRail
              meId={state.bill.hostParticipantId}
              brushId={phase === 'table' ? brushId : null}
              onSeat={
                phase === 'table'
                  ? (id) => setBrushId((b) => (b === id ? null : id))
                  : undefined
              }
              onAdd={
                phase === 'assemble'
                  ? () => setShowPeople((v) => !v)
                  : undefined
              }
              label={phase === 'table' ? 'Изберете четка' : 'Хората на масата'}
            />
          )}
          <PhaseActions
            phase={phase}
            final={final}
            blockers={blockers}
            setPhase={setPhase}
            undo={undo}
            clearUndo={clearUndo}
            onBack={onBack}
            compact
          />
        </div>
      </div>
    </div>
  )
}

function slipRank(s: Parameters<typeof seatStatus>[0]) {
  return { pending: 0, owes: 1, empty: 2, paid: 3, host: 4 }[seatStatus(s)]
}

function RestaurantInput() {
  const { state, dispatch } = useProto()
  return (
    <div>
      <label htmlFor="c-restaurant" className="sr-only">
        Име на заведението
      </label>
      <input
        id="c-restaurant"
        value={state.bill.restaurantName}
        onChange={(e) =>
          dispatch({ type: 'setRestaurant', name: e.target.value })
        }
        placeholder="Заведение"
        className="c-input !text-[22px] font-bold uppercase"
        style={{ fontFamily: 'var(--c-display)', fontStretch: 'normal' }}
      />
    </div>
  )
}

type ListPhase = Phase | 'final'

function LineList({
  phase,
  brushId,
  openKey,
  setOpenKey,
  onPaint,
  lineError,
  print,
}: {
  print: boolean
  phase: ListPhase
  brushId: string | null
  openKey: string | null
  setOpenKey: (k: string | null) => void
  onPaint: (key: string) => void
  lineError: { key: string; text: string } | null
}) {
  const { derived } = useProto()
  const [expanded, setExpanded] = useState(false)
  const collapsed = (phase === 'settle' || phase === 'final') && !expanded

  if (derived.groups.length === 0)
    return (
      <p className="py-6 text-center text-[12px] text-[var(--c-ink-muted)]">
        Бележката е празна. Върнете се на Сглобяване.
      </p>
    )

  if (collapsed)
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex min-h-12 w-full items-center justify-between gap-3 text-left text-[12px]"
      >
        <span>
          {derived.groups.length} реда, {derived.totalUnits} бройки
          {derived.unclaimedUnits > 0 &&
            `, ${derived.unclaimedUnits} неразпределени`}
        </span>
        <span className="flex items-center gap-1 font-semibold">
          Покажи{' '}
          <ChevronDown className="size-4" strokeWidth={1.75} aria-hidden />
        </span>
      </button>
    )

  const mode = phase === 'table' ? (brushId ? 'paint' : 'inspect') : 'readonly'
  return (
    <ul>
      {derived.groups.map((g, i) => (
        <div key={g.key}>
          <ClaimLine
            group={g}
            index={i}
            print={print}
            mode={mode}
            highlightIds={brushId ? [brushId] : []}
            open={openKey === g.key}
            error={lineError?.key === g.key ? lineError.text : null}
            onTap={mode === 'readonly' ? undefined : () => onPaint(g.key)}
            onMore={
              mode === 'readonly'
                ? undefined
                : () => setOpenKey(openKey === g.key ? null : g.key)
            }
          />
          <AnimatePresence initial={false}>
            {openKey === g.key && mode !== 'readonly' && (
              <HostUnitDrawer
                key="d"
                group={g}
                onClose={() => setOpenKey(null)}
              />
            )}
          </AnimatePresence>
        </div>
      ))}
    </ul>
  )
}

/** Desktop/tablet: the table column. Seats (as brush picker), people tray. */
function TableColumn({
  phase,
  final,
  brushId,
  setBrushId,
  showPeople,
  setShowPeople,
}: {
  phase: Phase
  final: boolean
  brushId: string | null
  setBrushId: (fn: (b: string | null) => string | null) => void
  showPeople: boolean
  setShowPeople: (fn: (v: boolean) => boolean) => void
}) {
  return (
    <section aria-label="Масата" className="space-y-3">
      <h2 className="c-display text-[14px] font-bold">Масата</h2>
      {phase === 'table' && !final && (
        <p className="text-[11px] leading-snug text-[var(--c-on-table-muted)]">
          Изберете човек за четка, после докосвайте редовете.
        </p>
      )}
      <SeatsRail
        orientation="column"
        meId="p-host"
        brushId={phase === 'table' && !final ? brushId : null}
        onSeat={
          phase === 'table' && !final
            ? (id) => setBrushId((b) => (b === id ? null : id))
            : undefined
        }
        onAdd={
          phase === 'assemble' && !final
            ? () => setShowPeople((v) => !v)
            : undefined
        }
      />
      {phase === 'assemble' && showPeople && !final && (
        <PeopleTray onClose={() => setShowPeople(() => false)} />
      )}
    </section>
  )
}

/* ------------------------------------------------- per-phase action area */

function PhaseActions({
  phase,
  final,
  blockers,
  setPhase,
  undo,
  clearUndo,
  onBack,
  compact,
}: {
  phase: Phase
  final: boolean
  blockers: string[]
  setPhase: (p: Phase) => void
  undo: UndoEntry | null
  clearUndo: () => void
  onBack: () => void
  compact?: boolean
}) {
  const { derived, dispatch, state } = useProto()
  const [confirm, setConfirm] = useState<'split' | 'close' | null>(null)
  const [triedNext, setTriedNext] = useState(false)
  const pending = derived.guests.filter((g) => g.pendingCents > 0)

  if (final)
    return (
      <Box>
        <p className="flex items-center gap-2 text-[12px]">
          <Lock className="size-4" strokeWidth={1.75} aria-hidden />
          Сметката е заключена.
          {derived.outstandingCents > 0 &&
            ` Остават ${formatMoney(derived.outstandingCents)} за събиране.`}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="c-ghost flex-1"
            onClick={() => dispatch({ type: 'reopen' })}
          >
            Отвори отново
          </button>
          <button type="button" className="c-btn flex-1" onClick={onBack}>
            Към сметките
          </button>
        </div>
      </Box>
    )

  if (phase === 'assemble')
    return (
      <Box>
        {triedNext && blockers.length > 0 && (
          <ul
            className="mb-2 space-y-0.5 text-[12px] font-semibold"
            role="alert"
          >
            {blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-2">
          {!compact && (
            <span className="flex-1 text-[12px] text-[var(--c-on-table-muted)]">
              {state.bill.items.length} реда, {derived.guests.length} гости
            </span>
          )}
          <button
            type="button"
            className={cn(
              blockers.length === 0 ? 'c-btn' : 'c-ghost !min-h-12',
              compact && 'w-full',
            )}
            onClick={() => {
              setTriedNext(true)
              if (blockers.length === 0) setPhase('table')
            }}
          >
            Сложи я на масата{' '}
            <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </Box>
    )

  const unclaimed = derived.unclaimedUnits
  return (
    <div className="space-y-2">
      {pending.length > 0 && phase === 'table' && <PendingBanner />}

      {phase === 'table' && (
        <Box tight>
          {undo ? (
            <UndoRow entry={undo} onDone={clearUndo} />
          ) : confirm === 'split' ? (
            <div className="text-[12px]">
              <p className="leading-snug">
                {unclaimed} бр. за {formatMoney(derived.unclaimedCents)} ще се
                разделят поравно между всички {derived.seats.length}, по около{' '}
                {formatMoney(
                  Math.round(derived.unclaimedCents / derived.seats.length),
                )}
                .
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="c-ghost flex-1"
                  onClick={() => setConfirm(null)}
                >
                  Откажи
                </button>
                <button
                  type="button"
                  className="c-btn flex-1"
                  onClick={() => {
                    dispatch({ type: 'splitRestEvenly' })
                    setConfirm(null)
                  }}
                >
                  Да, раздели
                </button>
              </div>
            </div>
          ) : unclaimed > 0 ? (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 leading-tight">
                <span className="block text-[11px] text-[var(--c-on-table-muted)]">
                  Неразпределени
                </span>
                <span className="c-display text-[15px] font-bold">
                  {unclaimed} бр.{' '}
                  <span className="text-[var(--c-on-table-muted)]">/</span>{' '}
                  {formatMoney(derived.unclaimedCents)}
                </span>
              </div>
              <button
                type="button"
                className="c-ghost shrink-0"
                onClick={() => setConfirm('split')}
                aria-label="Раздели остатъка поравно"
              >
                <Split className="size-4" strokeWidth={1.75} aria-hidden />
                Раздели поравно
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-[12px] leading-snug">
                Всичко е разпределено.
              </span>
              <button
                type="button"
                className="c-btn"
                onClick={() => setPhase('settle')}
              >
                Към разплащане{' '}
                <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
              </button>
            </div>
          )}
        </Box>
      )}

      {phase === 'settle' && (
        <Box tight>
          {confirm === 'close' ? (
            <div className="text-[12px]">
              <p className="font-semibold">Приключване с остатък</p>
              <ul className="mt-1 space-y-0.5 leading-snug">
                {unclaimed > 0 && (
                  <li>
                    {unclaimed} бр. ({formatMoney(derived.unclaimedCents)})
                    остават неразпределени.
                  </li>
                )}
                {derived.guests
                  .filter((g) => g.remainingCents > 0)
                  .map((g) => (
                    <li key={g.participantId}>
                      {g.name} дължи {formatMoney(g.remainingCents)}
                      {g.pendingCents > 0 ? ', чака потвърждение' : ''}.
                    </li>
                  ))}
              </ul>
              <p className="mt-1 text-[var(--c-on-table-muted)]">
                Редовете се заключват. Дълговете остават записани.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="c-ghost flex-1"
                  onClick={() => setConfirm(null)}
                >
                  Откажи
                </button>
                <button
                  type="button"
                  className="c-btn flex-1"
                  onClick={() => {
                    dispatch({ type: 'finalize' })
                    setConfirm(null)
                  }}
                >
                  Приключи
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 leading-tight">
                <span className="block text-[11px] text-[var(--c-on-table-muted)]">
                  {derived.pendingCents > 0
                    ? `Остават, ${formatMoney(derived.pendingCents)} чакат`
                    : 'Остават'}
                </span>
                <span className="c-display text-[18px] font-bold">
                  {formatMoney(derived.outstandingCents)}
                </span>
              </div>
              {derived.outstandingCents === 0 && unclaimed === 0 ? (
                <button
                  type="button"
                  className="c-btn"
                  onClick={() => dispatch({ type: 'finalize' })}
                >
                  Приключи
                </button>
              ) : (
                <button
                  type="button"
                  className="c-ghost"
                  onClick={() => setConfirm('close')}
                >
                  Приключи с остатък
                </button>
              )}
            </div>
          )}
        </Box>
      )}
    </div>
  )
}

/** One phone's „Платих“ can cover several seats: confirm them together. */
function PendingBanner() {
  const { state, derived, dispatch } = useProto()
  const first = state.bill.pending.at(0)
  if (!first) return null
  const batch = state.bill.pending.filter(
    (p) => p.byParticipantId === first.byParticipantId,
  )
  const by = derived.seats.find(
    (s) => s.participantId === first.byParticipantId,
  )
  const total = batch.reduce((s, p) => s + p.amountCents, 0)
  const others = batch
    .filter((p) => p.participantId !== first.byParticipantId)
    .map((p) => derived.labels[p.participantId])
  if (!by) return null
  return (
    <Box tight>
      <div className="flex items-center gap-2 text-[12px]">
        <SeatAvatar
          seat={by}
          index={seatIndex(derived.seats, by.participantId)}
          size="sm"
        />
        <span className="min-w-0 flex-1 leading-snug">
          {by.name} отбеляза превод <b>{formatMoney(total)}</b>
          {others.length > 0 && (
            <span className="text-[var(--c-on-table-muted)]">
              {' '}
              (и за {others.join(', ')})
            </span>
          )}
        </span>
        <button
          type="button"
          className="c-btn !min-h-11 !px-4"
          onClick={() =>
            batch.forEach((p) =>
              dispatch({
                type: 'confirmPayment',
                participantId: p.participantId,
              }),
            )
          }
        >
          Потвърди
        </button>
      </div>
    </Box>
  )
}

function Box({ children, tight }: { children: ReactNode; tight?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-[22px] bg-[var(--c-table)] md:bg-[var(--c-table-2)]',
        tight ? 'px-3 py-2' : 'p-3',
      )}
    >
      {children}
    </div>
  )
}
